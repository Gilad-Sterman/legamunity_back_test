const supabase = require('../config/database');

class SupabaseService {
  constructor() {
    this.supabase = supabase;
  }

  /**
   * Retry Supabase operations with exponential backoff
   * @param {Function} operation - The Supabase operation to retry
   * @param {number} maxRetries - Maximum number of retries
   * @param {number} baseDelay - Base delay in milliseconds
   */
  async retrySupabaseOperation(operation, maxRetries = 3, baseDelay = 1000) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await operation();
        return result;
      } catch (error) {
        console.log(` Supabase operation attempt ${attempt}/${maxRetries} failed:`, error.message);
        
        if (attempt === maxRetries) {
          throw error;
        }
        
        // Exponential backoff
        const delay = baseDelay * Math.pow(2, attempt - 1);
        console.log(` Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // ==================== SESSIONS ====================
  
  /**
   * Create a new session for a client
   */
  async createSession(sessionData) {
    try {
      // Map frontend data structure to database schema
      // Store complex data in the preferences JSONB column
      const sessionRecord = {
        client_name: sessionData.client_name,
        client_age: parseInt(sessionData.client_age),
        client_email: sessionData.client_contact?.email || null,
        client_phone: sessionData.client_contact?.phone || null,
        assigned_admin: sessionData.created_by || null,
        status: sessionData.status || 'pending',
        preferences: {
          // Store all additional data in preferences JSONB column
          client_contact: sessionData.client_contact || {},
          family_contact_details: {
            primary_contact: sessionData.primary_contact || {},
            emergency_contact: sessionData.emergency_contact || {}
          },
          preferred_language: sessionData.preferred_language || 'english',
          special_requirements: sessionData.special_requirements || '',
          accessibility_needs: sessionData.accessibility_needs || '',
          session_type: sessionData.session_type || 'Life Story Creation',
          priority_level: sessionData.priority_level || 'standard',
          estimated_duration: sessionData.estimated_duration || '4-6 weeks',
          preferred_schedule: sessionData.preferred_schedule || {},
          story_preferences: sessionData.story_preferences || {},
          interview_scheduling: sessionData.interview_scheduling || {},
          interviews: [], // Don't store interviews in preferences - use normalized interviews table instead
          metadata: sessionData.metadata || {},
          notes: sessionData.notes || '',
          friends: sessionData.friends || []
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('sessions')
        .insert([sessionRecord])
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error creating session:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get all sessions with optional filtering
   */
  async getSessions(filters = {}) {
    try {
      let query = supabase
        .from('sessions')
        .select(`
          *,
          interviews (
            id,
            type,
            status,
            scheduled_date,
            completed_date,
            duration,
            location,
            notes,
            content,
            created_at
          )
        `);

      // Apply filters
      if (filters.status) {
        query = query.eq('status', filters.status);
      }
      if (filters.assignedAdmin) {
        query = query.eq('assigned_admin', filters.assignedAdmin);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch all drafts for these sessions
      const sessionIds = data.map(session => session.id);
      let draftsData = [];
      
      if (sessionIds.length > 0) {
        const { data: drafts, error: draftsError } = await supabase
          .from('drafts')
          .select('*')
          .in('session_id', sessionIds)
          .order('version', { ascending: false });
        
        if (draftsError) {
          console.warn('Warning: Could not fetch drafts:', draftsError.message);
        } else {
          draftsData = drafts || [];
        }
      }

      // Calculate session metrics and associate drafts
      const sessionsWithMetrics = data.map(session => {
        const interviews = session.interviews || [];
        
        // Get drafts for this session
        const sessionDrafts = draftsData.filter(draft => draft.session_id === session.id);
        
        // Sort interviews by creation time to maintain consistent order
        const sortedInterviews = interviews.sort((a, b) => {
          return new Date(a.created_at) - new Date(b.created_at);
        });
        
        // Associate drafts with interviews using metadata
        const interviewsWithDrafts = sortedInterviews.map(interview => {
          const interviewDrafts = sessionDrafts.filter(draft => {
            // Check multiple possible ways the draft might be linked to the interview
            return draft.content?.metadata?.sourceInterview === interview.id ||
                   draft.content?.interview_id === interview.id ||
                   draft.content?.metadata?.id === interview.id;
          });
          
          // Sort drafts by version (highest first) to get the latest
          interviewDrafts.sort((a, b) => (b.version || 0) - (a.version || 0));
          
          // Set ai_draft property for frontend compatibility
          const latestDraft = interviewDrafts.length > 0 ? interviewDrafts[0] : null;
          
          return {
            ...interview,
            drafts: interviewDrafts,
            ai_draft: latestDraft // Frontend expects this property to show "Draft Generated" button
          };
        });
        
        // Calculate total duration
        const totalDuration = interviews.reduce((sum, interview) => {
          return sum + (interview.duration || 60); // Default 60 minutes if not set
        }, 0);

        // Calculate completion percentage
        const completedInterviews = interviews.filter(interview => 
          interview.status === 'completed'
        ).length;
        const totalInterviews = interviews.length;
        const completionPercentage = totalInterviews > 0 
          ? Math.round((completedInterviews / totalInterviews) * 100) 
          : 0;

        return {
          ...session,
          interviews: interviewsWithDrafts,
          drafts: sessionDrafts, // All drafts for the session
          totalDuration,
          completionPercentage,
          completedInterviews,
          totalInterviews
        };
      });

      return { success: true, data: sessionsWithMetrics };
    } catch (error) {
      console.error('Error fetching sessions:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update a session
   */
  async updateSession(sessionId, updateData) {
    try {
      const { data, error } = await supabase
        .from('sessions')
        .update({
          ...updateData,
          updated_at: new Date().toISOString()
        })
        .eq('id', sessionId)
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error updating session:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get a single session by ID
   */
  async getSessionById(sessionId) {
    try {
      const { data, error } = await supabase
        .from('sessions')
        .select(`
          *,
          interviews (
            *,
            created_at
          ),
          drafts (*)
        `)
        .eq('id', sessionId)
        .single();

      if (error) throw error;

      // Calculate session metrics
      const interviews = data.interviews || [];
      const drafts = data.drafts || [];
      
      // Sort interviews by creation time to maintain consistent order
      const sortedInterviews = interviews.sort((a, b) => {
        return new Date(a.created_at) - new Date(b.created_at);
      });
      
      // Associate drafts with interviews using metadata
      const interviewsWithDrafts = sortedInterviews.map(interview => {
        const interviewDrafts = drafts.filter(draft => {
          // Check multiple possible ways the draft might be linked to the interview
          return draft.content?.metadata?.sourceInterview === interview.id ||
                 draft.content?.interview_id === interview.id ||
                 draft.content?.metadata?.id === interview.id;
        });
        
        // Sort drafts by version (highest first) to get the latest
        interviewDrafts.sort((a, b) => (b.version || 0) - (a.version || 0));
        
        // Set ai_draft property for frontend compatibility
        const latestDraft = interviewDrafts.length > 0 ? interviewDrafts[0] : null;
        
        return {
          ...interview,
          drafts: interviewDrafts,
          ai_draft: latestDraft // Frontend expects this property to show "Draft Generated" button
        };
      });
      
      // Calculate total duration
      const totalDuration = interviews.reduce((sum, interview) => {
        return sum + (interview.duration || 60); // Default 60 minutes if not set
      }, 0);

      // Calculate completion percentage
      const completedInterviews = interviews.filter(interview => 
        interview.status === 'completed'
      ).length;
      const totalInterviews = interviews.length;
      const completionPercentage = totalInterviews > 0 
        ? Math.round((completedInterviews / totalInterviews) * 100) 
        : 0;

      const sessionWithMetrics = {
        ...data,
        interviews: interviewsWithDrafts, // Use interviews with draft associations
        drafts, // All drafts for the session
        totalDuration,
        completionPercentage,
        completedInterviews,
        totalInterviews
      };

      return { success: true, data: sessionWithMetrics };
    } catch (error) {
      console.error('Error fetching session:', error);
      return { success: false, error: error.message };
    }
  }

  // ==================== INTERVIEWS ====================

  /**
   * Add interview to normalized interviews table
   */
  async addInterviewToSession(sessionId, interviewData) {
    try {
      // Verify session exists
      const { data: session, error: sessionError } = await supabase
        .from('sessions')
        .select('id')
        .eq('id', sessionId)
        .single();

      if (sessionError) throw new Error(`Session not found: ${sessionError.message}`);

      // Create new interview object for normalized table
      const newInterview = {
        session_id: sessionId,
        type: interviewData.type || 'life_story',
        status: interviewData.status || 'pending',
        duration: interviewData.duration || 90,
        location: interviewData.location || 'online',
        notes: interviewData.notes || '',
        content: {
          name: interviewData.name || `Interview ${Date.now()}`,
          isFriendInterview: interviewData.is_friend_interview || interviewData.isFriendInterview || false
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Insert into normalized interviews table
      const { data: createdInterview, error } = await supabase
        .from('interviews')
        .insert(newInterview)
        .select()
        .single();

      if (error) throw error;

      return { success: true, data: createdInterview };
    } catch (error) {
      console.error('Error adding interview to session:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update interview within session's preferences.interviews array
   */
  async updateInterviewInSession(sessionId, interviewId, updateData) {
    try {
      // Updating interview (removed verbose logging)
      
      // First, try to update the normalized interview in the separate interviews table
      const { data: normalizedInterview, error: normalizedError } = await supabase
        .from('interviews')
        .update({
          ...updateData,
          updated_at: new Date().toISOString()
        })
        .eq('id', interviewId)
        .eq('session_id', sessionId)
        .select()
        .single();

      // Normalized update result (removed verbose logging)

      // If normalized interview exists, return it
      if (!normalizedError && normalizedInterview) {
        // Successfully updated normalized interview
        return { success: true, data: normalizedInterview };
      }
      
      // Normalized update failed, trying legacy structure...
      if (normalizedError) {
        console.error('Normalized update error:', normalizedError);
      }

      // If not found in normalized table, try legacy interviews in session preferences
      const { data: session, error: fetchError } = await supabase
        .from('sessions')
        .select('preferences')
        .eq('id', sessionId)
        .single();

      if (fetchError) throw fetchError;

      // Find and update the interview in legacy structure
      const interviews = session.preferences?.interviews || [];
      const interviewIndex = interviews.findIndex(interview => interview.id === interviewId);
      
      if (interviewIndex === -1) {
        throw new Error('Interview not found in either normalized table or legacy preferences');
      }

      // Update the interview in legacy structure
      const updatedInterviews = [...interviews];
      updatedInterviews[interviewIndex] = {
        ...updatedInterviews[interviewIndex],
        ...updateData,
        updated_at: new Date().toISOString()
      };

      // Update session preferences
      const updatedPreferences = {
        ...session.preferences,
        interviews: updatedInterviews
      };

      const { data, error } = await supabase
        .from('sessions')
        .update({ 
          preferences: updatedPreferences,
          updated_at: new Date().toISOString()
        })
        .eq('id', sessionId)
        .select()
        .single();

      if (error) throw error;
      return { success: true, data: updatedInterviews[interviewIndex] };
    } catch (error) {
      console.error('Error updating interview in session:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update interview content after completion
   */
  async updateInterviewContent(interviewId, content) {
    try {
      const { data, error } = await supabase
        .from('interviews')
        .update({
          content: content,
          status: 'completed',
          completed_date: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', interviewId)
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error updating interview content:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update session scheduling and change all pending interviews to scheduled
   */
  async updateSessionScheduling(sessionId, schedulingData) {
    try {
      // First, update all pending interviews in the separate interviews table to "scheduled"
      const { error: pendingStatusError } = await supabase
        .from('interviews')
        .update({
          status: 'scheduled',
          updated_at: new Date().toISOString()
        })
        .eq('session_id', sessionId)
        .eq('status', 'pending');

      if (pendingStatusError) {
        console.error('Error updating pending interview statuses:', pendingStatusError);
        // Don't throw here, continue with other updates
      }

      // Second, update duration and location for all non-completed interviews
      const updateData = {
        updated_at: new Date().toISOString()
      };
      
      if (schedulingData.duration) {
        updateData.duration = schedulingData.duration;
      }
      
      if (schedulingData.location) {
        updateData.location = schedulingData.location;
      }

      const { error: durationLocationError } = await supabase
        .from('interviews')
        .update(updateData)
        .eq('session_id', sessionId)
        .neq('status', 'completed'); // Update all except completed interviews

      if (durationLocationError) {
        console.error('Error updating interview duration/location:', durationLocationError);
        // Don't throw here, continue with session update
      }

      // Also update legacy interviews in session preferences if they exist
      const { data: session, error: fetchError } = await supabase
        .from('sessions')
        .select('preferences')
        .eq('id', sessionId)
        .single();

      if (!fetchError && session?.preferences?.interviews) {
        const updatedInterviews = session.preferences.interviews.map(interview => {
          const updatedInterview = {
            ...interview,
            status: interview.status === 'pending' ? 'scheduled' : interview.status,
            updated_at: new Date().toISOString()
          };

          // Update duration and location for all non-completed interviews
          if (interview.status !== 'completed') {
            if (schedulingData.duration) {
              updatedInterview.duration = schedulingData.duration;
            }
            if (schedulingData.location) {
              updatedInterview.location = schedulingData.location;
            }
          }

          return updatedInterview;
        });

        const updatedPreferences = {
          ...session.preferences,
          interview_scheduling: {
            ...session.preferences.interview_scheduling,
            ...schedulingData,
            enabled: true,
            updated_at: new Date().toISOString()
          },
          interviews: updatedInterviews
        };

        const { data, error } = await supabase
          .from('sessions')
          .update({
            preferences: updatedPreferences,
            updated_at: new Date().toISOString()
          })
          .eq('id', sessionId)
          .select()
          .single();

        if (error) throw error;
        return { success: true, data };
      } else {
        // No legacy interviews, just update session scheduling
        const { data: currentSession, error: getCurrentError } = await supabase
          .from('sessions')
          .select('preferences')
          .eq('id', sessionId)
          .single();

        if (getCurrentError) throw getCurrentError;

        const updatedPreferences = {
          ...currentSession.preferences,
          interview_scheduling: {
            ...currentSession.preferences?.interview_scheduling,
            ...schedulingData,
            enabled: true,
            updated_at: new Date().toISOString()
          }
        };

        const { data, error } = await supabase
          .from('sessions')
          .update({
            preferences: updatedPreferences,
            updated_at: new Date().toISOString()
          })
          .eq('id', sessionId)
          .select()
          .single();

        if (error) throw error;
        return { success: true, data };
      }
    } catch (error) {
      console.error('Error updating session scheduling:', error);
      return { success: false, error: error.message };
    }
  }

  // ==================== DRAFTS ====================

  /**
   * Create a new draft
   */
  // async createDraft(draftData) {
  //   try {
  //     const { data, error } = await supabase
  //       .from('drafts')
  //       .insert([{
  //         session_id: draftData.sessionId,
  //         version: draftData.version || 1,
  //         stage: draftData.stage || 'first_draft',
  //         content: draftData.content,
  //         completion_percentage: draftData.completionPercentage || 0,
  //         overall_rating: draftData.overallRating || null,
  //         created_at: new Date().toISOString(),
  //         updated_at: new Date().toISOString()
  //       }])
  //       .select()
  //       .single();

  //     if (error) throw error;
  //     return { success: true, data };
  //   } catch (error) {
  //     console.error('Error creating draft:', error);
  //     return { success: false, error: error.message };
  //   }
  // }

  /**
   * Get drafts for a session
   */
  // async getDraftsBySession(sessionId) {
  //   try {
  //     const { data, error } = await supabase
  //       .from('drafts')
  //       .select('*')
  //       .eq('session_id', sessionId)
  //       .order('version', { ascending: false });

  //     if (error) throw error;
  //     return { success: true, data };
  //   } catch (error) {
  //     console.error('Error fetching drafts:', error);
  //     return { success: false, error: error.message };
  //   }
  // }

  // ==================== USERS ====================

  /**
   * Get all users (for admin assignment, etc.)
   */
  async getUsers() {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, email, role')
        .order('name');

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error fetching users:', error);
      return { success: false, error: error.message };
    }
  }

  // ==================== UTILITY METHODS ====================

  /**
   * Test database connection
   */
  async testConnection() {
    try {
      const { data, error } = await supabase.rpc('version');
      if (error) throw error;
      return { success: true, message: 'Database connection successful', version: data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete a session
   */
  async deleteSession(sessionId) {
    try {
      // First, delete all drafts for this session
      const { error: draftDeleteError } = await supabase
        .from('drafts')
        .delete()
        .eq('session_id', sessionId);

      if (draftDeleteError) {
        console.warn('Error deleting drafts for session:', draftDeleteError);
        // Continue with deletion even if draft deletion fails
      }

      // Then, delete all interviews for this session
      const { error: interviewDeleteError } = await supabase
        .from('interviews')
        .delete()
        .eq('session_id', sessionId);

      if (interviewDeleteError) {
        console.warn('Error deleting interviews for session:', interviewDeleteError);
        // Continue with session deletion even if interview deletion fails
      }

      // Finally, delete the session itself
      const { data, error } = await supabase
        .from('sessions')
        .delete()
        .eq('id', sessionId);

      if (error) {
        // Handle not found case specifically if needed, though DELETE doesn't error on not found by default
        if (error.code === '22P02') { // Invalid input syntax, could mean UUID is wrong format
          return { success: false, error: 'Invalid session ID format' };
        }
        throw error;
      }
      return { success: true };
    } catch (error) {
      console.error('Error deleting session:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete an interview from normalized interviews table
   */
  async deleteInterviewFromSession(interviewId, sessionId) {
    try {
      // First, delete the interview from normalized interviews table
      const { data: deletedInterview, error: normalizedError } = await supabase
        .from('interviews')
        .delete()
        .eq('id', interviewId)
        .eq('session_id', sessionId)
        .select()
        .single();

      // If found and deleted from normalized table, start background draft cleanup and return success
      if (!normalizedError && deletedInterview) {
        // Start background draft cleanup (don't await)
        this.cleanupDraftsForInterview(interviewId, sessionId).catch(error => {
          console.warn('Background draft cleanup failed:', error);
        });
        
        return { success: true, data: deletedInterview };
      }

      // If not found in normalized table, try legacy interviews in session preferences
      const { data: session, error: findError } = await supabase
        .from('sessions')
        .select('id, preferences')
        .eq('id', sessionId)
        .single();

      if (findError) throw findError;

      if (!session || !session.preferences?.interviews) {
        return { success: false, error: 'Interview not found in either normalized table or legacy preferences' };
      }

      const originalInterviewCount = session.preferences.interviews.length;
      const updatedInterviews = session.preferences.interviews.filter(i => i.id !== interviewId);

      if (originalInterviewCount === updatedInterviews.length) {
        return { success: false, error: 'Interview ID did not match any interview in the session' };
      }

      const updatedPreferences = {
        ...session.preferences,
        interviews: updatedInterviews,
      };

      // Update the session with the interview removed from legacy structure
      const { data, error: updateError } = await supabase
        .from('sessions')
        .update({ 
          preferences: updatedPreferences,
          updated_at: new Date().toISOString()
        })
        .eq('id', sessionId)
        .select()
        .single();

      if (updateError) throw updateError;

      // Start background draft cleanup for legacy deletion too
      this.cleanupDraftsForInterview(interviewId, sessionId).catch(error => {
        console.warn('Background draft cleanup failed:', error);
      });
      
      return { success: true, data: { id: interviewId, deleted_from: 'legacy' } };
    } catch (error) {
      console.error('Error deleting interview from session:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Background cleanup of drafts associated with an interview
   */
  async cleanupDraftsForInterview(interviewId, sessionId) {
    try {
      // Find drafts associated with this interview
      const { data: draftsToDelete, error: findDraftsError } = await supabase
        .from('drafts')
        .select('id')
        .eq('session_id', sessionId);

      if (!findDraftsError && draftsToDelete && draftsToDelete.length > 0) {
        // Filter drafts that match the interview ID in their metadata
        const matchingDraftIds = [];
        
        for (const draft of draftsToDelete) {
          try {
            // Get the full draft to check its content
            const { data: fullDraft, error: draftError } = await supabase
              .from('drafts')
              .select('content')
              .eq('id', draft.id)
              .single();
            
            if (!draftError && fullDraft?.content?.metadata?.sourceInterview === interviewId) {
              matchingDraftIds.push(draft.id);
            }
          } catch (e) {
            console.warn('Error checking draft metadata:', e);
          }
        }
        
        // Delete the matching drafts
        if (matchingDraftIds.length > 0) {
          const { error: draftDeleteError } = await supabase
            .from('drafts')
            .delete()
            .in('id', matchingDraftIds);
          
          if (draftDeleteError) {
            console.warn('Error deleting drafts for interview:', draftDeleteError);
          } else {
            console.log(`Successfully deleted ${matchingDraftIds.length} draft(s) for interview ${interviewId}`);
          }
        }
      }
    } catch (error) {
      console.error('Error in background draft cleanup:', error);
      throw error;
    }
  }

  /**
   * Get session statistics for dashboard
   */
  async getSessionStats() {
    try {
      console.log('🔍 Fetching session statistics...');
      
      // Get total sessions count with retry logic
      const { count: totalSessions, error: countError } = await this.retrySupabaseOperation(
        () => supabase
          .from('sessions')
          .select('*', { count: 'exact', head: true })
      );

      if (countError) throw countError;

      // Get active sessions count (status = 'active' or 'in_progress')
      const { count: activeSessions, error: activeError } = await supabase
        .from('sessions')
        .select('*', { count: 'exact', head: true })
        .in('status', ['active', 'in_progress', 'scheduled']);

      if (activeError) throw activeError;

      // Get completed sessions - sessions where ALL interviews are completed
      const { data: allSessions, error: sessionsError } = await supabase
        .from('sessions')
        .select('id');

      if (sessionsError) throw sessionsError;

      let completedSessions = 0;
      if (allSessions && allSessions.length > 0) {
        for (const session of allSessions) {
          // Get all interviews for this session
          const { data: interviews, error: interviewsError } = await supabase
            .from('interviews')
            .select('status')
            .eq('session_id', session.id);

          if (!interviewsError && interviews && interviews.length > 0) {
            // Check if all interviews are completed
            const allCompleted = interviews.every(interview => interview.status === 'completed');
            if (allCompleted) {
              completedSessions++;
            }
          }
        }
      }

      // Get drafts awaiting approval
      const { count: draftsAwaitingApproval, error: draftsError } = await supabase
        .from('drafts')
        .select('*', { count: 'exact', head: true })
        .eq('stage', 'pending_review');

      if (draftsError) throw draftsError;

      // Get total drafts count
      const { count: totalDrafts, error: totalDraftsError } = await supabase
        .from('drafts')
        .select('*', { count: 'exact', head: true });

      if (totalDraftsError) throw totalDraftsError;

      // Get approved drafts count
      const { count: approvedDrafts, error: approvedDraftsError } = await supabase
        .from('drafts')
        .select('*', { count: 'exact', head: true })
        .eq('stage', 'approved');

      if (approvedDraftsError) throw approvedDraftsError;

      // Get rejected drafts count
      const { count: rejectedDrafts, error: rejectedDraftsError } = await supabase
        .from('drafts')
        .select('*', { count: 'exact', head: true })
        .eq('stage', 'rejected');

      if (rejectedDraftsError) throw rejectedDraftsError;

      // Get total interviews count
      const { count: totalInterviews, error: totalInterviewsError } = await supabase
        .from('interviews')
        .select('*', { count: 'exact', head: true });

      if (totalInterviewsError) throw totalInterviewsError;

      // Get completed interviews count
      const { count: completedInterviews, error: completedInterviewsError } = await supabase
        .from('interviews')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'completed');

      if (completedInterviewsError) throw completedInterviewsError;

      // Calculate interview completion rate
      const interviewCompletionRate = totalInterviews > 0 
        ? Math.round((completedInterviews / totalInterviews) * 100)
        : 0;

      // Calculate draft approval rate
      const draftApprovalRate = totalDrafts > 0 
        ? Math.round((approvedDrafts / totalDrafts) * 100)
        : 0;

      // Get recent activity (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { count: recentInterviews, error: recentInterviewsError } = await supabase
        .from('interviews')
        .select('*', { count: 'exact', head: true })
        .gte('updated_at', sevenDaysAgo.toISOString());

      if (recentInterviewsError) throw recentInterviewsError;

      const { count: recentDrafts, error: recentDraftsError } = await supabase
        .from('drafts')
        .select('*', { count: 'exact', head: true })
        .gte('updated_at', sevenDaysAgo.toISOString());

      if (recentDraftsError) throw recentDraftsError;

      // ==================== LIFE STORY STATISTICS ====================
      
      // Initialize life story stats with defaults
      let totalLifeStories = 0;
      let generatedLifeStories = 0;
      let approvedLifeStories = 0;
      let rejectedLifeStories = 0;
      let totalStoryWords = 0;
      let avgWordsPerStory = 0;

      try {
        // Get total life stories count
        const { count: totalCount, error: totalLifeStoriesError } = await supabase
          .from('full_life_stories')
          .select('*', { count: 'exact', head: true })
          .eq('is_current_version', true);

        if (!totalLifeStoriesError && totalCount !== null) {
          totalLifeStories = totalCount;
        }

        // Get generated life stories count (status = 'generated')
        const { count: generatedCount, error: generatedLifeStoriesError } = await supabase
          .from('full_life_stories')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'generated')
          .eq('is_current_version', true);

        if (!generatedLifeStoriesError && generatedCount !== null) {
          generatedLifeStories = generatedCount;
        }

        // Get approved life stories count (status = 'approved')
        const { count: approvedCount, error: approvedLifeStoriesError } = await supabase
          .from('full_life_stories')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'approved')
          .eq('is_current_version', true);

        if (!approvedLifeStoriesError && approvedCount !== null) {
          approvedLifeStories = approvedCount;
        }

        // Get rejected life stories count (check review_notes for rejection)
        const { data: allLifeStories, error: allLifeStoriesError } = await supabase
          .from('full_life_stories')
          .select('review_notes')
          .eq('status', 'generated')
          .eq('is_current_version', true);// Rejections are stored as 'generated' with review_notes

        if (!allLifeStoriesError && allLifeStories && allLifeStories.length > 0) {
          rejectedLifeStories = allLifeStories.filter(story => {
            if (!story.review_notes) return false;
            
            // Ensure review_notes is an array
            const reviewNotes = Array.isArray(story.review_notes) ? story.review_notes : [];
            if (reviewNotes.length === 0) return false;
            
            // Check if any review note contains rejection info
            return reviewNotes.some(note => 
              note && (
                note.action === 'rejected' || 
                (note.content && typeof note.content === 'string' && note.content.toLowerCase().includes('reject'))
              )
            );
          }).length;
        }

        // Get life stories with word counts for average calculation
        const { data: lifeStoriesWithContent, error: lifeStoriesContentError } = await supabase
          .from('full_life_stories')
          .select('content');

        if (!lifeStoriesContentError && lifeStoriesWithContent && lifeStoriesWithContent.length > 0) {
          const validStories = lifeStoriesWithContent.filter(story => 
            story.content && story.content.word_count && typeof story.content.word_count === 'number'
          );
          
          if (validStories.length > 0) {
            totalStoryWords = validStories.reduce((sum, story) => sum + story.content.word_count, 0);
            avgWordsPerStory = Math.round(totalStoryWords / validStories.length);
          }
        }

      } catch (lifeStoryError) {
        console.warn('⚠️ Error fetching life story statistics, using defaults:', lifeStoryError.message);
        // Keep default values (already initialized above)
      }

      return {
        success: true,
        data: {
          // Core session metrics
          totalSessions,
          activeSessions,
          completedSessions,
          
          // Draft metrics
          totalDrafts,
          draftsAwaitingApproval,
          approvedDrafts,
          rejectedDrafts,
          draftApprovalRate,
          
          // Interview metrics
          totalInterviews,
          completedInterviews,
          interviewCompletionRate,
          
          // Life story metrics
          totalLifeStories: totalLifeStories || 0,
          generatedLifeStories: generatedLifeStories || 0,
          approvedLifeStories: approvedLifeStories || 0,
          rejectedLifeStories,
          avgWordsPerStory,
          totalStoryWords,
          
          // Recent activity
          recentInterviews,
          recentDrafts,
          
          // Legacy metrics for backward compatibility
          pendingReview: draftsAwaitingApproval,
          averageCqs: draftApprovalRate // Use draft approval rate as quality metric
        }
      };
    } catch (error) {
      console.error('Error fetching session statistics:', error);
      return { success: false, error: error.message };
    }
  }

  // ==================== DRAFTS ====================

  /**
   * Create a new draft
   */
  async createDraft(draftData) {
    try {
      const draftRecord = {
        session_id: draftData.session_id,
        version: draftData.version || 1,
        stage: draftData.stage || 'first_draft',
        content: draftData.content || {}
      };

      const { data, error } = await supabase
        .from('drafts')
        .insert([draftRecord])
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error creating draft:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update an existing draft
   */
  async updateDraft(draftId, updateData) {
    try {
      const { data, error } = await supabase
        .from('drafts')
        .update(updateData)
        .eq('id', draftId)
        .select()
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (error) {
      console.error('Error updating draft:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get all drafts for a session with interview information
   */
  async getDraftsBySessionId(sessionId) {
    try {
      // First get the drafts
      const { data: drafts, error: draftsError } = await supabase
        .from('drafts')
        .select('*')
        .eq('session_id', sessionId)
        .order('version', { ascending: false });

      if (draftsError) throw draftsError;

      // Get session with interviews to match draft data
      const { data: session, error: sessionError } = await supabase
        .from('sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (sessionError) throw sessionError;

      // Get interviews for this session separately
      const { data: interviews, error: interviewsError } = await supabase
        .from('interviews')
        .select('*')
        .eq('session_id', sessionId);

      // Don't throw error if interviews don't exist, just use empty array
      const sessionInterviews = interviews || [];

      // Calculate draft statistics
      const totalDrafts = drafts.length;
      const approvedDrafts = drafts.filter(d => d.stage === 'approved').length;
      const rejectedDrafts = drafts.filter(d => d.stage === 'rejected').length;
      const pendingDrafts = totalDrafts - approvedDrafts - rejectedDrafts;

      // Enhance drafts with interview information and proper completion calculation
      const enhancedDrafts = drafts.map(draft => {
        // Calculate actual completion percentage based on interviews
        const completedInterviews = sessionInterviews.filter(i => i.status === 'completed').length || 0;
        const totalInterviews = sessionInterviews.length || 1;
        const actualCompletionPercentage = Math.round((completedInterviews / totalInterviews) * 100);

        // Find corresponding interview for this draft (if any)
        const correspondingInterview = sessionInterviews.find(i => 
          i.ai_draft && i.ai_draft.title === draft.content?.title
        ) || sessionInterviews[draft.version - 1];

        // Get interview name with better fallback logic
        let interviewName = 'Unknown Interview';
        if (correspondingInterview) {
          if (correspondingInterview.content && correspondingInterview.content.name) {
            interviewName = correspondingInterview.content.name;
          } else if (correspondingInterview.type) {
            // Convert type to readable name
            const typeNames = {
              'personal': 'Personal Life Interview',
              'career': 'Career & Work Interview', 
              'relationships': 'Relationships Interview',
              'life_events': 'Life Events Interview',
              'wisdom': 'Wisdom & Reflections Interview',
              'general': 'General Interview'
            };
            interviewName = typeNames[correspondingInterview.type] || `${correspondingInterview.type} Interview`;
          }
        } else {
          interviewName = `Interview ${draft.version}`;
        }

        return {
          ...draft,
          completion_percentage: actualCompletionPercentage,
          interview_name: interviewName,
          interview_type: correspondingInterview?.type || 'general',
          session_info: {
            client_name: session.client_name,
            total_interviews: totalInterviews,
            completed_interviews: completedInterviews,
            total_drafts: totalDrafts,
            approved_drafts: approvedDrafts,
            rejected_drafts: rejectedDrafts,
            pending_drafts: pendingDrafts
          }
        };
      });

      return { success: true, data: enhancedDrafts };
    } catch (error) {
      console.error('Error fetching drafts by session:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get draft by ID
   */
  async getDraftById(draftId) {
    try {
      const { data, error } = await supabase
        .from('drafts')
        .select('*')
        .eq('id', draftId)
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error fetching draft by ID:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update a draft
   */
  async updateDraft(draftId, updateData) {
    try {
      const updateRecord = {
        ...updateData,
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('drafts')
        .update(updateRecord)
        .eq('id', draftId)
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error updating draft:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete a draft
   */
  async deleteDraft(draftId) {
    try {
      const { data, error } = await supabase
        .from('drafts')
        .delete()
        .eq('id', draftId)
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error deleting draft:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get all drafts with filtering and pagination
   */
  async getAllDrafts(filters = {}) {
    try {
      let query = supabase
        .from('drafts')
        .select(`
          *,
          sessions!inner(
            id,
            client_name,
            status
          )
        `);

      // Apply filters
      if (filters.stage) {
        query = query.eq('stage', filters.stage);
      }
      if (filters.sessionId) {
        query = query.eq('session_id', filters.sessionId);
      }
      if (filters.minCompletion) {
        query = query.gte('completion_percentage', filters.minCompletion);
      }

      // Apply pagination
      if (filters.limit) {
        query = query.limit(filters.limit);
      }
      if (filters.offset) {
        query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error fetching all drafts:', error);
      return { success: false, error: error.message };
    }
  }

  // ==================== DRAFT NOTES ====================

  /**
   * Add a note to a draft (store in content.notes for now since notes column doesn't exist)
   */
  async addNoteToDraft(draftId, noteData) {
    try {
      // First, get the current draft to access existing content
      const { data: currentDraft, error: fetchError } = await supabase
        .from('drafts')
        .select('content')
        .eq('id', draftId)
        .single();

      if (fetchError) throw fetchError;

      // Create new note object
      const newNote = {
        id: `note-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        content: noteData.content,
        author: noteData.author || 'Admin User',
        createdAt: new Date().toISOString(),
        draftId: draftId
      };

      // Add new note to existing notes array in content
      const currentContent = currentDraft.content || {};
      const existingNotes = currentContent.notes || [];
      const updatedNotes = [...existingNotes, newNote];

      // Update the draft with new notes in content
      const updatedContent = {
        ...currentContent,
        notes: updatedNotes
      };

      const { data, error } = await supabase
        .from('drafts')
        .update({ 
          content: updatedContent,
          updated_at: new Date().toISOString()
        })
        .eq('id', draftId)
        .select()
        .single();

      if (error) throw error;
      return { success: true, data, note: newNote };
    } catch (error) {
      console.error('Error adding note to draft:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update draft stage (for approval/rejection)
   */
  async updateDraftStage(draftId, stageData) {
    try {
      // First get the current draft to preserve existing content
      const { data: currentDraft, error: fetchError } = await supabase
        .from('drafts')
        .select('content')
        .eq('id', draftId)
        .single();

      if (fetchError) throw fetchError;

      // Prepare the content with approval/rejection metadata
      const updatedContent = { ...currentDraft.content };

      // Add stage-specific metadata to content
      if (stageData.stage === 'approved') {
        updatedContent.approval_metadata = {
          approved_by: stageData.approvedBy || 'Admin User',
          approved_at: new Date().toISOString()
        };
        // Remove any rejection metadata if it exists
        delete updatedContent.rejection_metadata;
      } else if (stageData.stage === 'rejected') {
        updatedContent.rejection_metadata = {
          rejected_by: stageData.rejectedBy || 'Admin User',
          rejected_at: new Date().toISOString(),
          rejection_reason: stageData.rejectionReason || ''
        };
        // Remove any approval metadata if it exists
        delete updatedContent.approval_metadata;
      }

      const updateRecord = {
        stage: stageData.stage,
        content: updatedContent,
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('drafts')
        .update(updateRecord)
        .eq('id', draftId)
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error updating draft stage:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new SupabaseService();
