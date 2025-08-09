const interviewService = require('../services/interviewService');
const supabaseService = require('../services/supabaseService');

class MigrationController {

  /**
   * Migrate interviews for a specific session
   * @route POST /api/migration/interviews/:sessionId
   * @access Admin
   */
  async migrateSessionInterviews(req, res) {
    try {
      const { sessionId } = req.params;
      
      console.log(`Starting interview migration for session: ${sessionId}`);
      
      const result = await interviewService.migrateSessionInterviews(sessionId);
      
      if (result.success) {
        res.status(200).json({
          success: true,
          message: result.message,
          migratedCount: result.migratedCount,
          data: result.migratedInterviews
        });
      } else {
        res.status(400).json({
          success: false,
          message: 'Migration failed',
          error: result.error
        });
      }
    } catch (error) {
      console.error('Error in migrateSessionInterviews:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during migration',
        error: error.message
      });
    }
  }

  /**
   * Migrate interviews for all sessions
   * @route POST /api/migration/interviews/all
   * @access Admin
   */
  async migrateAllSessionInterviews(req, res) {
    try {
      console.log('Starting migration for all sessions...');
      
      // Get all sessions
      const sessionsResult = await supabaseService.getAllSessions();
      
      if (!sessionsResult.success) {
        return res.status(400).json({
          success: false,
          message: 'Failed to fetch sessions',
          error: sessionsResult.error
        });
      }

      const sessions = sessionsResult.data || [];
      const migrationResults = [];
      let totalMigrated = 0;

      for (const session of sessions) {
        console.log(`Migrating interviews for session: ${session.id}`);
        
        const result = await interviewService.migrateSessionInterviews(session.id);
        migrationResults.push({
          sessionId: session.id,
          clientName: session.client_name,
          ...result
        });
        
        if (result.success) {
          totalMigrated += result.migratedCount || 0;
        }
      }

      res.status(200).json({
        success: true,
        message: `Migration completed. Total interviews migrated: ${totalMigrated}`,
        totalSessions: sessions.length,
        totalMigrated,
        results: migrationResults
      });

    } catch (error) {
      console.error('Error in migrateAllSessionInterviews:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during bulk migration',
        error: error.message
      });
    }
  }

  /**
   * Check migration status for a session
   * @route GET /api/migration/interviews/:sessionId/status
   * @access Admin
   */
  async checkMigrationStatus(req, res) {
    try {
      const { sessionId } = req.params;
      
      // Get interviews from both sources
      const tableResult = await interviewService.getInterviewsBySessionId(sessionId);
      const compatResult = await interviewService.getInterviewsWithBackwardCompatibility(sessionId);
      
      // Get session preferences to check if interviews still exist there
      const sessionResult = await supabaseService.getSessionById(sessionId);
      const preferencesInterviews = sessionResult.success ? 
        (sessionResult.data.preferences?.interviews || []) : [];

      const status = {
        sessionId,
        interviewsInTable: tableResult.success ? tableResult.data.length : 0,
        interviewsInPreferences: preferencesInterviews.length,
        migrationNeeded: preferencesInterviews.length > 0 && (!tableResult.success || tableResult.data.length === 0),
        migrationCompleted: tableResult.success && tableResult.data.length > 0,
        cleanupNeeded: tableResult.success && tableResult.data.length > 0 && preferencesInterviews.length > 0
      };

      res.status(200).json({
        success: true,
        data: status
      });

    } catch (error) {
      console.error('Error checking migration status:', error);
      res.status(500).json({
        success: false,
        message: 'Error checking migration status',
        error: error.message
      });
    }
  }

  /**
   * Clean up interviews from session preferences after migration
   * @route POST /api/migration/interviews/:sessionId/cleanup
   * @access Admin
   */
  async cleanupSessionPreferences(req, res) {
    try {
      const { sessionId } = req.params;
      
      // First verify that interviews exist in the interviews table
      const tableResult = await interviewService.getInterviewsBySessionId(sessionId);
      
      if (!tableResult.success || tableResult.data.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Cannot cleanup preferences: No interviews found in interviews table. Run migration first.'
        });
      }

      const result = await interviewService.cleanupPreferencesInterviews(sessionId);
      
      if (result.success) {
        res.status(200).json({
          success: true,
          message: 'Successfully cleaned up interviews from session preferences',
          data: result.data
        });
      } else {
        res.status(400).json({
          success: false,
          message: 'Cleanup failed',
          error: result.error
        });
      }

    } catch (error) {
      console.error('Error in cleanupSessionPreferences:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during cleanup',
        error: error.message
      });
    }
  }

  /**
   * Get migration overview for all sessions
   * @route GET /api/migration/interviews/overview
   * @access Admin
   */
  async getMigrationOverview(req, res) {
    try {
      const sessionsResult = await supabaseService.getAllSessions();
      
      if (!sessionsResult.success) {
        return res.status(400).json({
          success: false,
          message: 'Failed to fetch sessions',
          error: sessionsResult.error
        });
      }

      const sessions = sessionsResult.data || [];
      const overview = {
        totalSessions: sessions.length,
        sessionsNeedingMigration: 0,
        sessionsMigrated: 0,
        sessionsNeedingCleanup: 0,
        totalInterviewsInPreferences: 0,
        totalInterviewsInTable: 0,
        sessions: []
      };

      for (const session of sessions) {
        const tableResult = await interviewService.getInterviewsBySessionId(session.id);
        const preferencesInterviews = session.preferences?.interviews || [];
        
        const sessionStatus = {
          sessionId: session.id,
          clientName: session.client_name,
          interviewsInTable: tableResult.success ? tableResult.data.length : 0,
          interviewsInPreferences: preferencesInterviews.length,
          needsMigration: preferencesInterviews.length > 0 && (!tableResult.success || tableResult.data.length === 0),
          migrated: tableResult.success && tableResult.data.length > 0,
          needsCleanup: tableResult.success && tableResult.data.length > 0 && preferencesInterviews.length > 0
        };

        overview.sessions.push(sessionStatus);
        overview.totalInterviewsInPreferences += preferencesInterviews.length;
        overview.totalInterviewsInTable += sessionStatus.interviewsInTable;
        
        if (sessionStatus.needsMigration) overview.sessionsNeedingMigration++;
        if (sessionStatus.migrated) overview.sessionsMigrated++;
        if (sessionStatus.needsCleanup) overview.sessionsNeedingCleanup++;
      }

      res.status(200).json({
        success: true,
        data: overview
      });

    } catch (error) {
      console.error('Error getting migration overview:', error);
      res.status(500).json({
        success: false,
        message: 'Error getting migration overview',
        error: error.message
      });
    }
  }
}

module.exports = new MigrationController();
