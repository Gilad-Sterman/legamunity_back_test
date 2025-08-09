const supabase = require('../config/database');

class SupabaseService {
  
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
          interviews: sessionData.interviews || [],
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
            content
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

      // Calculate session metrics for each session
      const sessionsWithMetrics = data.map(session => {
        const interviews = session.interviews || [];
        
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
          interviews (*),
          drafts (*)
        `)
        .eq('id', sessionId)
        .single();

      if (error) throw error;

      // Calculate session metrics
      const interviews = data.interviews || [];
      
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
   * Add interview to session's preferences.interviews array
   */
  async addInterviewToSession(sessionId, interviewData) {
    try {
      // First get the current session
      const { data: session, error: fetchError } = await supabase
        .from('sessions')
        .select('preferences')
        .eq('id', sessionId)
        .single();

      if (fetchError) throw fetchError;

      // Create new interview object
      const newInterview = {
        id: `interview_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: interviewData.name || `Interview ${(session.preferences?.interviews?.length || 0) + 1}`,
        type: interviewData.type || 'life_story',
        status: interviewData.status || 'pending',
        duration: interviewData.duration || 90,
        location: interviewData.location || 'online',
        isFriendInterview: interviewData.isFriendInterview || false,
        notes: interviewData.notes || '',
        created_at: new Date().toISOString()
      };

      // Update session preferences with new interview
      const updatedPreferences = {
        ...session.preferences,
        interviews: [...(session.preferences?.interviews || []), newInterview]
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
      return { success: true, data: newInterview };
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

      // If normalized interview exists, return it
      if (!normalizedError && normalizedInterview) {
        return { success: true, data: normalizedInterview };
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
  async createDraft(draftData) {
    try {
      const { data, error } = await supabase
        .from('drafts')
        .insert([{
          session_id: draftData.sessionId,
          version: draftData.version || 1,
          stage: draftData.stage || 'first_draft',
          content: draftData.content,
          completion_percentage: draftData.completionPercentage || 0,
          overall_rating: draftData.overallRating || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
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
   * Get drafts for a session
   */
  async getDraftsBySession(sessionId) {
    try {
      const { data, error } = await supabase
        .from('drafts')
        .select('*')
        .eq('session_id', sessionId)
        .order('version', { ascending: false });

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error fetching drafts:', error);
      return { success: false, error: error.message };
    }
  }

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
   * Delete an interview from a session by its ID
   */
  async deleteInterviewFromSession(interviewId, sessionId) {
    try {
      // Find the session containing the interview
      const { data: session, error: findError } = await supabase
        .from('sessions')
        .select('id, preferences')
        .eq('id', sessionId)
        .limit(1)
        .single();

      if (findError) throw findError;

      if (!session) {
        return { success: false, error: 'Interview not found in any session' };
      }

      const originalInterviewCount = session.preferences.interviews.length;
      const updatedInterviews = session.preferences.interviews.filter(i => i.id !== interviewId);

      if (originalInterviewCount === updatedInterviews.length) {
        // This case should ideally not be hit if the above filter worked, but as a safeguard:
        return { success: false, error: 'Interview ID did not match any interview in the session' };
      }

      const updatedPreferences = {
        ...session.preferences,
        interviews: updatedInterviews,
      };

      // Update the session with the interview removed
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

      return { success: true, data };
    } catch (error) {
      console.error('Error deleting interview from session:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get session statistics for dashboard
   */
  async getSessionStats() {
    try {
      // Get total sessions count
      const { count: totalSessions, error: countError } = await supabase
        .from('sessions')
        .select('*', { count: 'exact', head: true });

      if (countError) throw countError;

      // Get active sessions count (status = 'active' or 'in_progress')
      const { count: activeSessions, error: activeError } = await supabase
        .from('sessions')
        .select('*', { count: 'exact', head: true })
        .in('status', ['active', 'in_progress']);

      if (activeError) throw activeError;

      // Get pending review count (status = 'pending_review')
      const { count: pendingReview, error: pendingError } = await supabase
        .from('sessions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending_review');

      if (pendingError) throw pendingError;

      // Calculate average CQS (Content Quality Score) from all sessions
      // This is a placeholder - in a real app, you'd calculate this from actual data
      const { data: sessionsWithCqs, error: cqsError } = await supabase
        .from('sessions')
        .select('preferences')
        .not('preferences->cqs_score', 'is', null);

      if (cqsError) throw cqsError;

      // Calculate average CQS if available
      let averageCqs = 0;
      if (sessionsWithCqs && sessionsWithCqs.length > 0) {
        const totalCqs = sessionsWithCqs.reduce((sum, session) => {
          return sum + (session.preferences.cqs_score || 0);
        }, 0);
        averageCqs = Math.round(totalCqs / sessionsWithCqs.length);
      }

      return {
        success: true,
        data: {
          totalSessions,
          activeSessions,
          pendingReview,
          averageCqs
        }
      };
    } catch (error) {
      console.error('Error fetching session statistics:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new SupabaseService();
