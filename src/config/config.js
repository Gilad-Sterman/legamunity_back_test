/**
 * Application configuration
 * In production, these values should come from environment variables
 */

module.exports = {
  // JWT secret for token signing/verification
  jwtSecret: process.env.JWT_SECRET,
  
  // Server port
  port: process.env.PORT || 5000,
  
  // Environment
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Token expiration (in seconds)
  tokenExpiration: 86400, // 24 hours
};
