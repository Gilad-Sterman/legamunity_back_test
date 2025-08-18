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
  
  // AI Service Configuration
  ai: {
    // n8n AI processing endpoint URL
    endpointUrl: process.env.AI_ENDPOINT_URL || null,
    
    // n8n recordings endpoint URL (with sessionId template)
    recordingsEndpointUrl: process.env.AI_RECORDINGS_ENDPOINT_URL || null,
    
    // API key for AI service authentication (if required)
    apiKey: process.env.AI_API_KEY || null,
    
    // Enable/disable mock mode (when true, uses mock responses instead of real API)
    mockMode: false,
    
    // Request timeout in milliseconds
    requestTimeout: parseInt(process.env.AI_REQUEST_TIMEOUT) || 60000, // 60 seconds
    
    // Retry configuration
    maxRetries: parseInt(process.env.AI_MAX_RETRIES) || 2,
    retryDelay: parseInt(process.env.AI_RETRY_DELAY) || 2000, // 2 seconds
  }
};
