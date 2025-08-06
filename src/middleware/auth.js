const jwt = require('jsonwebtoken');
const config = require('../config/config');

/**
 * Middleware to verify JWT token and attach user to request
 */
exports.verifyToken = (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }
    
    // Extract token from Bearer format
    const token = authHeader.split(' ')[1];
    
    // Verify token
    const decoded = jwt.verify(token, config.jwtSecret);
    
    // Attach user info to request
    req.user = decoded;
    
    next();
  } catch (error) {
    console.error('Token verification failed:', error.message);
    return res.status(401).json({
      success: false,
      message: 'Invalid token',
      error: error.message
    });
  }
};

/**
 * Middleware to check if user has admin role
 * Must be used after verifyToken middleware
 */
exports.requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }
  
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin privileges required.'
    });
  }
  
  next();
};
