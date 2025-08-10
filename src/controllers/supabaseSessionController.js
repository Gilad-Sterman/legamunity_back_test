const supabaseService = require('../services/supabaseService');
// Check if this file is used 


class SupabaseSessionController {
  
  /**
   * Create a new session
   * POST /api/sessions
   */
  async createSession(req, res) {
    try {
      const { clientName, clientAge, clientEmail, clientPhone, assignedAdmin, preferences } = req.body;

      // Validate required fields
      if (!clientName) {
        return res.status(400).json({
          success: false,
          message: 'Client name is required'
        });
      }

      const sessionData = {
        clientName,
        clientAge,
        clientEmail,
        clientPhone,
        assignedAdmin,
        preferences,
        status: 'active'
      };

      const result = await supabaseService.createSession(sessionData);

      if (!result.success) {
        return res.status(500).json({
          success: false,
          message: 'Failed to create session',
          error: result.error
        });
      }

      res.status(201).json({
        success: true,
        message: 'Session created successfully',
        data: result.data
      });

    } catch (error) {
      console.error('Error in createSession:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  /**
   * Get all sessions with optional filtering
   * GET /api/sessions
   */
  async getSessions(req, res) {
    try {
      const { status, assignedAdmin } = req.query;
      
      const filters = {};
      if (status) filters.status = status;
      if (assignedAdmin) filters.assignedAdmin = assignedAdmin;

      const result = await supabaseService.getSessions(filters);

      if (!result.success) {
        return res.status(500).json({
          success: false,
          message: 'Failed to fetch sessions',
          error: result.error
        });
      }

      res.json({
        success: true,
        data: result.data,
        count: result.data.length
      });

    } catch (error) {
      console.error('Error in getSessions:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  /**
   * Get a single session by ID
   * GET /api/sessions/:id
   */
  async getSessionById(req, res) {
    try {
      const { id } = req.params;

      const result = await supabaseService.getSessionById(id);

      if (!result.success) {
        return res.status(404).json({
          success: false,
          message: 'Session not found',
          error: result.error
        });
      }

      res.json({
        success: true,
        data: result.data
      });

    } catch (error) {
      console.error('Error in getSessionById:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  /**
   * Schedule a new interview for a session
   * POST /api/sessions/:id/interviews
   */
  async scheduleInterview(req, res) {
    try {
      const { id: sessionId } = req.params;
      const { type, scheduledDate, duration, location, notes } = req.body;

      // Validate required fields
      if (!type || !scheduledDate) {
        return res.status(400).json({
          success: false,
          message: 'Interview type and scheduled date are required'
        });
      }

      const interviewData = {
        sessionId,
        type,
        scheduledDate,
        duration,
        location,
        notes,
        status: 'scheduled'
      };

      const result = await supabaseService.createInterview(interviewData);

      if (!result.success) {
        return res.status(500).json({
          success: false,
          message: 'Failed to schedule interview',
          error: result.error
        });
      }

      res.status(201).json({
        success: true,
        message: 'Interview scheduled successfully',
        data: result.data
      });

    } catch (error) {
      console.error('Error in scheduleInterview:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  /**
   * Get users for admin assignment dropdown
   * GET /api/users
   */
  async getUsers(req, res) {
    try {
      const result = await supabaseService.getUsers();

      if (!result.success) {
        return res.status(500).json({
          success: false,
          message: 'Failed to fetch users',
          error: result.error
        });
      }

      res.json({
        success: true,
        data: result.data
      });

    } catch (error) {
      console.error('Error in getUsers:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  /**
   * Test database connection
   * GET /api/test-connection
   */
  async testConnection(req, res) {
    try {
      const result = await supabaseService.testConnection();

      if (!result.success) {
        return res.status(500).json({
          success: false,
          message: 'Database connection failed',
          error: result.error
        });
      }

      res.json({
        success: true,
        message: result.message,
        version: result.version
      });

    } catch (error) {
      console.error('Error in testConnection:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }
}

module.exports = new SupabaseSessionController();
