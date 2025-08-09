const interviewService = require('./interviewService');
const supabaseService = require('./supabaseService');

/**
 * Hybrid Interview Service
 * This service provides backward compatibility during the migration period
 * It automatically checks both the interviews table and session preferences
 * and uses the appropriate data source
 */
class HybridInterviewService {

  /**
   * Get interviews for a session with automatic fallback
   * Checks interviews table first, falls back to session preferences
   */
  async getSessionInterviews(sessionId) {
    try {
      // First try the new interviews table
      const tableResult = await interviewService.getInterviewsBySessionId(sessionId);
      
      if (tableResult.success && tableResult.data.length > 0) {
        // Convert interviews table format to match frontend expectations
        return {
          success: true,
          data: tableResult.data.map(interview => this.normalizeInterviewFormat(interview, 'table')),
          source: 'interviews_table'
        };
      }

      // Fallback to session preferences
      const sessionResult = await supabaseService.getSessionById(sessionId);
      if (sessionResult.success && sessionResult.data.preferences?.interviews) {
        return {
          success: true,
          data: sessionResult.data.preferences.interviews.map(interview => 
            this.normalizeInterviewFormat(interview, 'preferences')
          ),
          source: 'session_preferences'
        };
      }

      // No interviews found in either location
      return {
        success: true,
        data: [],
        source: 'none'
      };

    } catch (error) {
      console.error('Error getting session interviews:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Add interview with automatic routing
   * Uses interviews table if session already has interviews there,
   * otherwise falls back to session preferences
   */
  async addInterview(sessionId, interviewData) {
    try {
      // Check where existing interviews are stored
      const existingResult = await this.getSessionInterviews(sessionId);
      
      if (!existingResult.success) {
        return existingResult;
      }

      // If we have interviews in the table or no interviews at all, use the table
      if (existingResult.source === 'interviews_table' || existingResult.source === 'none') {
        const result = await interviewService.createInterview(sessionId, interviewData);
        if (result.success) {
          return {
            success: true,
            data: this.normalizeInterviewFormat(result.data, 'table'),
            source: 'interviews_table'
          };
        }
        return result;
      }

      // Otherwise, use the old method for backward compatibility
      const result = await supabaseService.addInterviewToSession(sessionId, interviewData);
      if (result.success) {
        return {
          success: true,
          data: this.normalizeInterviewFormat(result.data, 'preferences'),
          source: 'session_preferences'
        };
      }
      return result;

    } catch (error) {
      console.error('Error adding interview:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update interview with automatic routing
   */
  async updateInterview(sessionId, interviewId, updateData) {
    try {
      // First try to update in interviews table
      const tableResult = await interviewService.updateInterview(interviewId, updateData);
      
      if (tableResult.success) {
        return {
          success: true,
          data: this.normalizeInterviewFormat(tableResult.data, 'table'),
          source: 'interviews_table'
        };
      }

      // If not found in table, try the old method
      const result = await supabaseService.updateInterviewInSession(sessionId, interviewId, updateData);
      if (result.success) {
        return {
          success: true,
          data: this.normalizeInterviewFormat(result.data, 'preferences'),
          source: 'session_preferences'
        };
      }
      return result;

    } catch (error) {
      console.error('Error updating interview:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete interview with automatic routing
   */
  async deleteInterview(sessionId, interviewId) {
    try {
      // First try to delete from interviews table
      const tableResult = await interviewService.deleteInterview(interviewId);
      
      if (tableResult.success) {
        return {
          success: true,
          data: tableResult.data,
          source: 'interviews_table'
        };
      }

      // If not found in table, try the old method
      const result = await supabaseService.deleteInterviewFromSession(interviewId, sessionId);
      return {
        ...result,
        source: 'session_preferences'
      };

    } catch (error) {
      console.error('Error deleting interview:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Normalize interview format to ensure consistency between data sources
   * This ensures the frontend receives a consistent format regardless of source
   */
  normalizeInterviewFormat(interview, source) {
    if (source === 'table') {
      // Convert from interviews table format to frontend format
      return {
        id: interview.id,
        name: interview.content?.name || `Interview ${interview.id.slice(-4)}`,
        type: interview.type,
        status: interview.status,
        duration: interview.duration,
        location: interview.location,
        scheduled_date: interview.scheduled_date,
        completed_date: interview.completed_date,
        notes: interview.notes,
        created_at: interview.created_at,
        updated_at: interview.updated_at,
        // Preserve content fields for backward compatibility
        isFriendInterview: interview.content?.isFriendInterview || false,
        file_upload: interview.content?.file_upload || null,
        transcription: interview.content?.transcription || null,
        ai_draft: interview.content?.ai_draft || null,
        content: interview.content || {}
      };
    } else {
      // Preferences format is already in the expected format
      return {
        ...interview,
        // Ensure required fields exist
        scheduled_date: interview.scheduled_date || null,
        completed_date: interview.completed_date || null,
        updated_at: interview.updated_at || interview.created_at
      };
    }
  }

  /**
   * Get migration status for a session
   */
  async getMigrationStatus(sessionId) {
    try {
      const tableResult = await interviewService.getInterviewsBySessionId(sessionId);
      const sessionResult = await supabaseService.getSessionById(sessionId);
      
      const preferencesInterviews = sessionResult.success ? 
        (sessionResult.data.preferences?.interviews || []) : [];

      return {
        success: true,
        data: {
          sessionId,
          interviewsInTable: tableResult.success ? tableResult.data.length : 0,
          interviewsInPreferences: preferencesInterviews.length,
          migrationNeeded: preferencesInterviews.length > 0 && (!tableResult.success || tableResult.data.length === 0),
          migrationCompleted: tableResult.success && tableResult.data.length > 0,
          cleanupNeeded: tableResult.success && tableResult.data.length > 0 && preferencesInterviews.length > 0,
          currentSource: tableResult.success && tableResult.data.length > 0 ? 'interviews_table' : 
                        preferencesInterviews.length > 0 ? 'session_preferences' : 'none'
        }
      };
    } catch (error) {
      console.error('Error getting migration status:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Trigger migration for a session if needed
   */
  async ensureMigrated(sessionId) {
    try {
      const status = await this.getMigrationStatus(sessionId);
      
      if (!status.success) {
        return status;
      }

      if (status.data.migrationNeeded) {
        console.log(`Auto-migrating interviews for session ${sessionId}`);
        const migrationResult = await interviewService.migrateSessionInterviews(sessionId);
        
        if (migrationResult.success) {
          console.log(`Successfully migrated ${migrationResult.migratedCount} interviews for session ${sessionId}`);
        }
        
        return migrationResult;
      }

      return { success: true, message: 'No migration needed' };
    } catch (error) {
      console.error('Error ensuring migration:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new HybridInterviewService();
