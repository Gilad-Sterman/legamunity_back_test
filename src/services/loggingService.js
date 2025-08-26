const supabase = require('../config/database');

class LoggingService {
  /**
   * Log an event to the database
   * @param {Object} logData - The log data
   * @param {string} logData.eventType - Type of event (auth, session, interview, file, draft, error, system)
   * @param {string} logData.eventAction - Action performed (login, logout, created, updated, deleted, uploaded, generated, error)
   * @param {string} logData.userId - User ID (optional)
   * @param {string} logData.userEmail - User email (optional)
   * @param {string} logData.sessionId - Session ID (optional)
   * @param {string} logData.interviewId - Interview ID (optional)
   * @param {string} logData.resourceId - Generic resource ID (optional)
   * @param {string} logData.resourceType - Type of resource (optional)
   * @param {Object} logData.eventData - Event-specific data (optional)
   * @param {string} logData.ipAddress - IP address (optional)
   * @param {string} logData.userAgent - User agent (optional)
   * @param {string} logData.errorMessage - Error message for error events (optional)
   * @param {string} logData.errorStack - Error stack trace (optional)
   * @param {string} logData.severity - Severity level (info, warning, error, critical)
   * @param {Object} logData.metadata - Additional metadata (optional)
   */
  async logEvent(logData) {
    try {
      const {
        eventType,
        eventAction,
        userId = null,
        userEmail = null,
        sessionId = null,
        interviewId = null,
        resourceId = null,
        resourceType = null,
        eventData = null,
        ipAddress = null,
        userAgent = null,
        errorMessage = null,
        errorStack = null,
        severity = 'info',
        metadata = null
      } = logData;

      const { data, error } = await supabase
        .from('logs')
        .insert([{
          event_type: eventType,
          event_action: eventAction,
          user_id: userId,
          user_email: userEmail,
          session_id: sessionId,
          interview_id: interviewId,
          resource_id: resourceId,
          resource_type: resourceType,
          event_data: eventData,
          ip_address: ipAddress,
          user_agent: userAgent,
          error_message: errorMessage,
          error_stack: errorStack,
          severity,
          metadata
        }]);

      if (error) {
        console.error('Failed to log event:', error);
        return { success: false, error: error.message };
      }

      return { success: true, data };
    } catch (error) {
      console.error('Logging service error:', error);
      return { success: false, error: error.message };
    }
  }

  // Authentication Events
  async logLogin(userId, userEmail, ipAddress, userAgent, loginMethod = 'email') {
    return this.logEvent({
      eventType: 'auth',
      eventAction: 'login',
      userId,
      userEmail,
      ipAddress,
      userAgent,
      eventData: { loginMethod, success: true },
      severity: 'info'
    });
  }

  async logLogout(userId, userEmail, ipAddress, userAgent) {
    return this.logEvent({
      eventType: 'auth',
      eventAction: 'logout',
      userId,
      userEmail,
      ipAddress,
      userAgent,
      eventData: { success: true },
      severity: 'info'
    });
  }

  async logFailedLogin(userEmail, ipAddress, userAgent, reason) {
    return this.logEvent({
      eventType: 'auth',
      eventAction: 'login_failed',
      userEmail,
      ipAddress,
      userAgent,
      eventData: { reason, success: false },
      severity: 'warning'
    });
  }

  // Session Events
  async logSessionCreated(userId, userEmail, sessionId, sessionData, ipAddress, userAgent) {
    return this.logEvent({
      eventType: 'session',
      eventAction: 'created',
      userId,
      userEmail,
      sessionId,
      ipAddress,
      userAgent,
      eventData: {
        clientName: sessionData.client_name,
        priority: sessionData.priority_level,
        language: sessionData.preferred_language
      },
      severity: 'info'
    });
  }

  async logSessionUpdated(userId, userEmail, sessionId, changes, ipAddress, userAgent) {
    return this.logEvent({
      eventType: 'session',
      eventAction: 'updated',
      userId,
      userEmail,
      sessionId,
      ipAddress,
      userAgent,
      eventData: { changes },
      severity: 'info'
    });
  }

  async logSessionDeleted(userId, userEmail, sessionId, sessionData, ipAddress, userAgent) {
    return this.logEvent({
      eventType: 'session',
      eventAction: 'deleted',
      userId,
      userEmail,
      sessionId,
      ipAddress,
      userAgent,
      eventData: {
        clientName: sessionData.client_name,
        deletedAt: new Date().toISOString()
      },
      severity: 'info'
    });
  }

  // Interview Events
  async logInterviewCreated(userId, userEmail, sessionId, interviewId, interviewData, ipAddress, userAgent) {
    return this.logEvent({
      eventType: 'interview',
      eventAction: 'created',
      userId,
      userEmail,
      sessionId,
      interviewId,
      ipAddress,
      userAgent,
      eventData: {
        interviewType: interviewData.type,
        scheduledDate: interviewData.scheduled_date,
        duration: interviewData.duration
      },
      severity: 'info'
    });
  }

  async logInterviewUpdated(userId, userEmail, sessionId, interviewId, changes, ipAddress, userAgent) {
    return this.logEvent({
      eventType: 'interview',
      eventAction: 'updated',
      userId,
      userEmail,
      sessionId,
      interviewId,
      ipAddress,
      userAgent,
      eventData: { changes },
      severity: 'info'
    });
  }

  async logInterviewDeleted(userId, userEmail, sessionId, interviewId, ipAddress, userAgent) {
    return this.logEvent({
      eventType: 'interview',
      eventAction: 'deleted',
      userId,
      userEmail,
      sessionId,
      interviewId,
      ipAddress,
      userAgent,
      eventData: { deletedAt: new Date().toISOString() },
      severity: 'info'
    });
  }

  // File Upload Events
  async logFileUploaded(userId, userEmail, sessionId, interviewId, fileData, ipAddress, userAgent) {
    return this.logEvent({
      eventType: 'file',
      eventAction: 'uploaded',
      userId,
      userEmail,
      sessionId,
      interviewId,
      ipAddress,
      userAgent,
      eventData: {
        fileName: fileData.originalName,
        fileSize: fileData.fileSize,
        mimeType: fileData.mimeType,
        storageUrl: fileData.storageUrl
      },
      severity: 'info'
    });
  }

  // Draft Generation Events
  async logDraftCreated(userId, userEmail, sessionId, draftId, draftData, ipAddress, userAgent) {
    return this.logEvent({
      eventType: 'draft',
      eventAction: 'created',
      userId,
      userEmail,
      sessionId,
      resourceId: draftId,
      resourceType: 'draft',
      ipAddress,
      userAgent,
      eventData: {
        version: draftData.version,
        stage: draftData.stage,
        contentLength: draftData.contentLength
      },
      severity: 'info'
    });
  }

  async logDraftGenerated(userId, userEmail, sessionId, interviewId, draftData, ipAddress, userAgent) {
    return this.logEvent({
      eventType: 'draft',
      eventAction: 'generated',
      userId,
      userEmail,
      sessionId,
      interviewId,
      ipAddress,
      userAgent,
      eventData: {
        draftTitle: draftData.title,
        wordCount: draftData.content?.summary?.length || 0,
        sectionsCount: draftData.content?.sections?.length || 0,
        processingTime: draftData.metadata?.processingTime
      },
      severity: 'info'
    });
  }

  // Error Events
  async logError(userId, userEmail, errorMessage, errorStack, context, ipAddress, userAgent, severity = 'error') {
    return this.logEvent({
      eventType: 'error',
      eventAction: 'error',
      userId,
      userEmail,
      ipAddress,
      userAgent,
      errorMessage,
      errorStack,
      eventData: context,
      severity
    });
  }

  // System Events
  async logSystemEvent(eventAction, eventData, severity = 'info') {
    return this.logEvent({
      eventType: 'system',
      eventAction,
      userEmail: 'system@legamunity.com',
      eventData,
      severity
    });
  }

  // Query Methods
  async getLogs(filters = {}) {
    try {
      let query = supabase.from('logs').select('*');

      // Apply filters
      if (filters.eventType) {
        query = query.eq('event_type', filters.eventType);
      }
      if (filters.eventAction) {
        query = query.eq('event_action', filters.eventAction);
      }
      if (filters.userId) {
        query = query.eq('user_id', filters.userId);
      }
      if (filters.sessionId) {
        query = query.eq('session_id', filters.sessionId);
      }
      if (filters.severity) {
        query = query.eq('severity', filters.severity);
      }
      if (filters.startDate) {
        query = query.gte('created_at', filters.startDate);
      }
      if (filters.endDate) {
        query = query.lte('created_at', filters.endDate);
      }

      // Pagination
      const limit = filters.limit || 100;
      const offset = filters.offset || 0;
      query = query.range(offset, offset + limit - 1);

      // Order by created_at desc
      query = query.order('created_at', { ascending: false });

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      return { success: true, data };
    } catch (error) {
      console.error('Failed to get logs:', error);
      return { success: false, error: error.message };
    }
  }

  async getLogStats(filters = {}) {
    try {
      let query = supabase.from('logs').select('event_type, event_action, severity, created_at');

      // Apply date filters
      if (filters.startDate) {
        query = query.gte('created_at', filters.startDate);
      }
      if (filters.endDate) {
        query = query.lte('created_at', filters.endDate);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      // Process stats
      const stats = {
        total: data.length,
        byType: {},
        byAction: {},
        bySeverity: {},
        byDate: {}
      };

      data.forEach(log => {
        // Count by type
        stats.byType[log.event_type] = (stats.byType[log.event_type] || 0) + 1;
        
        // Count by action
        stats.byAction[log.event_action] = (stats.byAction[log.event_action] || 0) + 1;
        
        // Count by severity
        stats.bySeverity[log.severity] = (stats.bySeverity[log.severity] || 0) + 1;
        
        // Count by date
        const date = log.created_at.split('T')[0];
        stats.byDate[date] = (stats.byDate[date] || 0) + 1;
      });

      return { success: true, data: stats };
    } catch (error) {
      console.error('Failed to get log stats:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new LoggingService();
