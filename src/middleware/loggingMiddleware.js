const loggingService = require('../services/loggingService');

/**
 * Middleware to extract request information for logging
 * Adds logging helpers to the request object
 */
const loggingMiddleware = (req, res, next) => {
  // Extract request information
  const ipAddress = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'];
  const userAgent = req.headers['user-agent'];
  
  // Add logging helper functions to request object
  req.logEvent = (logData) => {
    return loggingService.logEvent({
      ...logData,
      ipAddress,
      userAgent,
      userId: req.user?.id || null,
      userEmail: req.user?.email || null
    });
  };

  // Authentication logging helpers
  req.logLogin = (userId, userEmail, loginMethod = 'email') => {
    return loggingService.logLogin(userId, userEmail, ipAddress, userAgent, loginMethod);
  };

  req.logLogout = (userId, userEmail) => {
    return loggingService.logLogout(userId, userEmail, ipAddress, userAgent);
  };

  req.logFailedLogin = (userEmail, reason) => {
    return loggingService.logFailedLogin(userEmail, ipAddress, userAgent, reason);
  };

  // Session logging helpers
  req.logSessionCreated = (sessionId, sessionData) => {
    return loggingService.logSessionCreated(
      req.user?.id,
      req.user?.email,
      sessionId,
      sessionData,
      ipAddress,
      userAgent
    );
  };

  req.logSessionUpdated = (sessionId, changes) => {
    return loggingService.logSessionUpdated(
      req.user?.id,
      req.user?.email,
      sessionId,
      changes,
      ipAddress,
      userAgent
    );
  };

  req.logSessionDeleted = (sessionId, sessionData) => {
    return loggingService.logSessionDeleted(
      req.user?.id,
      req.user?.email,
      sessionId,
      sessionData,
      ipAddress,
      userAgent
    );
  };

  // Interview logging helpers
  req.logInterviewCreated = (sessionId, interviewId, interviewData) => {
    return loggingService.logInterviewCreated(
      req.user?.id,
      req.user?.email,
      sessionId,
      interviewId,
      interviewData,
      ipAddress,
      userAgent
    );
  };

  req.logInterviewUpdated = (sessionId, interviewId, changes) => {
    return loggingService.logInterviewUpdated(
      req.user?.id,
      req.user?.email,
      sessionId,
      interviewId,
      changes,
      ipAddress,
      userAgent
    );
  };

  req.logInterviewDeleted = (sessionId, interviewId) => {
    return loggingService.logInterviewDeleted(
      req.user?.id,
      req.user?.email,
      sessionId,
      interviewId,
      ipAddress,
      userAgent
    );
  };

  // File upload logging helper
  req.logFileUploaded = (sessionId, interviewId, fileData) => {
    return loggingService.logFileUploaded(
      req.user?.id,
      req.user?.email,
      sessionId,
      interviewId,
      fileData,
      ipAddress,
      userAgent
    );
  };

  // Draft generation logging helper
  req.logDraftGenerated = (sessionId, interviewId, draftData) => {
    return loggingService.logDraftGenerated(
      req.user?.id,
      req.user?.email,
      sessionId,
      interviewId,
      draftData,
      ipAddress,
      userAgent
    );
  };

  // Error logging helper
  req.logError = (errorMessage, errorStack, context, severity = 'error') => {
    return loggingService.logError(
      req.user?.id,
      req.user?.email,
      errorMessage,
      errorStack,
      context,
      ipAddress,
      userAgent,
      severity
    );
  };

  next();
};

/**
 * Error handling middleware that logs errors
 */
const errorLoggingMiddleware = (err, req, res, next) => {
  // Log the error
  req.logError(
    err.message,
    err.stack,
    {
      method: req.method,
      url: req.url,
      body: req.body,
      params: req.params,
      query: req.query
    },
    'error'
  );

  // Continue with normal error handling
  next(err);
};

/**
 * Request logging middleware for API access logs
 */
const requestLoggingMiddleware = (req, res, next) => {
  const start = Date.now();
  
  // Override res.end to capture response details
  const originalEnd = res.end;
  res.end = function(chunk, encoding) {
    const duration = Date.now() - start;
    
    // Log API request
    req.logEvent({
      eventType: 'system',
      eventAction: 'api_request',
      eventData: {
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        duration,
        userAgent: req.headers['user-agent'],
        contentLength: res.get('content-length') || 0
      },
      severity: res.statusCode >= 400 ? 'warning' : 'info'
    });

    originalEnd.call(this, chunk, encoding);
  };

  next();
};

module.exports = {
  loggingMiddleware,
  errorLoggingMiddleware,
  requestLoggingMiddleware
};
