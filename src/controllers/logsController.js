const loggingService = require('../services/loggingService');

class LogsController {
  /**
   * Get logs with filtering and pagination
   */
  async getLogs(req, res) {
    try {
      const {
        eventType,
        eventAction,
        userId,
        sessionId,
        severity,
        startDate,
        endDate,
        limit = 100,
        offset = 0
      } = req.query;

      const filters = {
        eventType,
        eventAction,
        userId,
        sessionId,
        severity,
        startDate,
        endDate,
        limit: parseInt(limit),
        offset: parseInt(offset)
      };

      const result = await loggingService.getLogs(filters);

      if (!result.success) {
        return res.status(500).json({
          success: false,
          error: result.error
        });
      }

      res.json({
        success: true,
        data: result.data,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total: result.data.length
        }
      });
    } catch (error) {
      console.error('Get logs error:', error);
      req.logError(error.message, error.stack, { action: 'getLogs' });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve logs'
      });
    }
  }

  /**
   * Get log statistics
   */
  async getLogStats(req, res) {
    try {
      const { startDate, endDate } = req.query;
      
      const filters = {
        startDate,
        endDate
      };

      const result = await loggingService.getLogStats(filters);

      if (!result.success) {
        return res.status(500).json({
          success: false,
          error: result.error
        });
      }

      res.json({
        success: true,
        data: result.data
      });
    } catch (error) {
      console.error('Get log stats error:', error);
      req.logError(error.message, error.stack, { action: 'getLogStats' });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve log statistics'
      });
    }
  }

  /**
   * Get recent error logs
   */
  async getRecentErrors(req, res) {
    try {
      const { limit = 50 } = req.query;

      const filters = {
        eventType: 'error',
        limit: parseInt(limit),
        offset: 0
      };

      const result = await loggingService.getLogs(filters);

      if (!result.success) {
        return res.status(500).json({
          success: false,
          error: result.error
        });
      }

      res.json({
        success: true,
        data: result.data
      });
    } catch (error) {
      console.error('Get recent errors error:', error);
      req.logError(error.message, error.stack, { action: 'getRecentErrors' });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve recent errors'
      });
    }
  }

  /**
   * Get user activity logs
   */
  async getUserActivity(req, res) {
    try {
      const { userId } = req.params;
      const { limit = 100, offset = 0 } = req.query;

      const filters = {
        userId,
        limit: parseInt(limit),
        offset: parseInt(offset)
      };

      const result = await loggingService.getLogs(filters);

      if (!result.success) {
        return res.status(500).json({
          success: false,
          error: result.error
        });
      }

      res.json({
        success: true,
        data: result.data,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total: result.data.length
        }
      });
    } catch (error) {
      console.error('Get user activity error:', error);
      req.logError(error.message, error.stack, { action: 'getUserActivity', userId: req.params.userId });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve user activity'
      });
    }
  }

  /**
   * Get session-related logs
   */
  async getSessionLogs(req, res) {
    try {
      const { sessionId } = req.params;
      const { limit = 100, offset = 0 } = req.query;

      const filters = {
        sessionId,
        limit: parseInt(limit),
        offset: parseInt(offset)
      };

      const result = await loggingService.getLogs(filters);

      if (!result.success) {
        return res.status(500).json({
          success: false,
          error: result.error
        });
      }

      res.json({
        success: true,
        data: result.data,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total: result.data.length
        }
      });
    } catch (error) {
      console.error('Get session logs error:', error);
      req.logError(error.message, error.stack, { action: 'getSessionLogs', sessionId: req.params.sessionId });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve session logs'
      });
    }
  }

  /**
   * Manual log entry (for testing or special cases)
   */
  async createLog(req, res) {
    try {
      const logData = req.body;
      
      const result = await loggingService.logEvent(logData);

      if (!result.success) {
        return res.status(500).json({
          success: false,
          error: result.error
        });
      }

      res.status(201).json({
        success: true,
        data: result.data,
        message: 'Log entry created successfully'
      });
    } catch (error) {
      console.error('Create log error:', error);
      req.logError(error.message, error.stack, { action: 'createLog', body: req.body });
      res.status(500).json({
        success: false,
        error: 'Failed to create log entry'
      });
    }
  }

  /**
   * Get system health logs
   */
  async getSystemHealth(req, res) {
    try {
      const { hours = 24 } = req.query;
      const startDate = new Date(Date.now() - (hours * 60 * 60 * 1000)).toISOString();

      const filters = {
        eventType: 'system',
        startDate,
        limit: 1000
      };

      const result = await loggingService.getLogs(filters);

      if (!result.success) {
        return res.status(500).json({
          success: false,
          error: result.error
        });
      }

      // Process system health data
      const healthData = {
        totalEvents: result.data.length,
        errors: result.data.filter(log => log.severity === 'error').length,
        warnings: result.data.filter(log => log.severity === 'warning').length,
        apiRequests: result.data.filter(log => log.event_action === 'api_request').length,
        averageResponseTime: 0,
        recentErrors: result.data
          .filter(log => log.severity === 'error')
          .slice(0, 10)
      };

      // Calculate average response time from API requests
      const apiLogs = result.data.filter(log => 
        log.event_action === 'api_request' && 
        log.event_data?.duration
      );
      
      if (apiLogs.length > 0) {
        const totalDuration = apiLogs.reduce((sum, log) => sum + log.event_data.duration, 0);
        healthData.averageResponseTime = Math.round(totalDuration / apiLogs.length);
      }

      res.json({
        success: true,
        data: healthData
      });
    } catch (error) {
      console.error('Get system health error:', error);
      req.logError(error.message, error.stack, { action: 'getSystemHealth' });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve system health data'
      });
    }
  }
}

module.exports = new LogsController();
