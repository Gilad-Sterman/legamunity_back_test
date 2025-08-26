const supabase = require('../config/database');
const loggingService = require('./loggingService');

class InterviewService {
  
  /**
   * Create a new interview in the interviews table
   */
  async createInterview(sessionId, interviewData) {
    try {
      const interviewRecord = {
        session_id: sessionId,
        type: interviewData.type || 'life_story',
        scheduled_date: interviewData.scheduled_date || null,
        completed_date: interviewData.completed_date || null,
        duration: parseInt(interviewData.duration) || 60,
        location: interviewData.location || 'online',
        status: interviewData.status || 'scheduled',
        content: interviewData.content || {},
        notes: interviewData.notes || '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('interviews')
        .insert([interviewRecord])
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error creating interview:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get all interviews for a session
   */
  async getInterviewsBySessionId(sessionId) {
    try {
      const { data, error } = await supabase
        .from('interviews')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      console.error('Error fetching interviews for session:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get a single interview by ID
   */
  async getInterviewById(interviewId) {
    try {
      const { data, error } = await supabase
        .from('interviews')
        .select('*')
        .eq('id', interviewId)
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error fetching interview:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update an interview
   */
  async updateInterview(interviewId, updateData) {
    try {
      const updateRecord = {
        ...updateData,
        updated_at: new Date().toISOString()
      };

      // Remove fields that shouldn't be updated directly
      delete updateRecord.id;
      delete updateRecord.session_id;
      delete updateRecord.created_at;

      const { data, error } = await supabase
        .from('interviews')
        .update(updateRecord)
        .eq('id', interviewId)
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error updating interview:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete an interview
   */
  async deleteInterview(interviewId) {
    try {
      const { data, error } = await supabase
        .from('interviews')
        .delete()
        .eq('id', interviewId)
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error deleting interview:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Migrate interviews from session preferences to interviews table
   * This is a one-time migration function
   */
  async migrateSessionInterviews(sessionId) {
    try {
      // Get session with current interviews in preferences
      const { data: session, error: sessionError } = await supabase
        .from('sessions')
        .select('id, preferences')
        .eq('id', sessionId)
        .single();

      if (sessionError) throw sessionError;

      const interviewsInPreferences = session.preferences?.interviews || [];
      
      if (interviewsInPreferences.length === 0) {
        return { success: true, message: 'No interviews to migrate', migratedCount: 0 };
      }

      // Check if interviews already exist in interviews table for this session
      const existingInterviews = await this.getInterviewsBySessionId(sessionId);
      if (existingInterviews.success && existingInterviews.data.length > 0) {
        return { success: true, message: 'Interviews already migrated', migratedCount: 0 };
      }

      // Migrate each interview
      const migratedInterviews = [];
      for (const oldInterview of interviewsInPreferences) {
        const interviewData = {
          type: oldInterview.type || 'life_story',
          scheduled_date: oldInterview.scheduled_date || null,
          completed_date: oldInterview.completed_date || null,
          duration: oldInterview.duration || 60,
          location: oldInterview.location || 'online',
          status: oldInterview.status || 'scheduled',
          content: {
            // Preserve any existing content from the old interview
            name: oldInterview.name,
            isFriendInterview: oldInterview.isFriendInterview || false,
            file_upload: oldInterview.file_upload || null,
            transcription: oldInterview.transcription || null,
            ai_draft: oldInterview.ai_draft || null,
            ...oldInterview.content
          },
          notes: oldInterview.notes || ''
        };

        const result = await this.createInterview(sessionId, interviewData);
        if (result.success) {
          migratedInterviews.push(result.data);
        } else {
          console.error(`Failed to migrate interview ${oldInterview.id}:`, result.error);
        }
      }

      // After successful migration, we could optionally remove interviews from preferences
      // But for safety, we'll keep them for now and remove them in a separate step
      
      return { 
        success: true, 
        message: `Successfully migrated ${migratedInterviews.length} interviews`,
        migratedCount: migratedInterviews.length,
        migratedInterviews
      };

    } catch (error) {
      console.error('Error migrating session interviews:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get interviews with backward compatibility
   * This method checks both the interviews table and session preferences
   * and returns a unified result during the migration period
   */
  async getInterviewsWithBackwardCompatibility(sessionId) {
    try {
      // First try to get interviews from the interviews table
      const tableResult = await this.getInterviewsBySessionId(sessionId);
      
      if (tableResult.success && tableResult.data.length > 0) {
        // If we have interviews in the table, use those
        return tableResult;
      }

      // Fallback to session preferences for backward compatibility
      const { data: session, error: sessionError } = await supabase
        .from('sessions')
        .select('preferences')
        .eq('id', sessionId)
        .single();

      if (sessionError) throw sessionError;

      const preferencesInterviews = session.preferences?.interviews || [];
      
      return { 
        success: true, 
        data: preferencesInterviews,
        source: 'preferences' // Indicate source for debugging
      };

    } catch (error) {
      console.error('Error getting interviews with backward compatibility:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Clean up interviews from session preferences after successful migration
   * Only call this after confirming the migration was successful
   */
  async cleanupPreferencesInterviews(sessionId) {
    try {
      const { data: session, error: sessionError } = await supabase
        .from('sessions')
        .select('preferences')
        .eq('id', sessionId)
        .single();

      if (sessionError) throw sessionError;

      // Remove interviews from preferences while keeping other preference data
      const updatedPreferences = { ...session.preferences };
      delete updatedPreferences.interviews;

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

    } catch (error) {
      console.error('Error cleaning up preferences interviews:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new InterviewService();
