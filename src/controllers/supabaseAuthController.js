const supabaseAuthService = require('../services/supabaseAuthService');
const loggingService = require('../services/loggingService');

/**
 * Supabase Authentication Controller
 * Maintains the same API interface as Firebase auth controller
 * for seamless migration without breaking frontend
 */

class SupabaseAuthController {

  /**
   * Register a new user
   * POST /api/auth/register
   */
  async register(req, res) {
    try {
      const { email, password, displayName, role, phone } = req.body;

      // Validate required fields
      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Email and password are required'
        });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid email format'
        });
      }

      // Validate password strength
      if (password.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'Password must be at least 6 characters long'
        });
      }

      // For admin registration, verify the request is from an admin
      if (role === 'admin') {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
          return res.status(401).json({
            success: false,
            message: 'Admin registration requires authentication'
          });
        }

        // Verify admin token (simplified for now)
        // In production, you'd verify the requesting user is an admin
      }

      const userData = {
        displayName: displayName || '',
        role: role || 'user',
        phone: phone || null
      };

      const result = await supabaseAuthService.registerUser(email, password, userData);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: result.error || 'Registration failed'
        });
      }

      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        user: result.user,
        token: result.token,
        needsEmailVerification: result.needsEmailVerification
      });

    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  /**
   * Login user
   * POST /api/auth/login
   */
  async login(req, res) {
    try {
      const { email, password } = req.body;

      // Validate required fields
      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Email and password are required'
        });
      }

      const result = await supabaseAuthService.loginUser(email, password);

      if (!result.success) {
        // Log failed login attempt
        try {
          const ipAddress = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'];
          const userAgent = req.headers['user-agent'];
          await loggingService.logFailedLogin(email, ipAddress, userAgent, result.error || 'Invalid credentials');
        } catch (logError) {
          console.error('Failed to log failed login:', logError);
        }
        
        return res.status(401).json({
          success: false,
          message: result.error || 'Invalid credentials'
        });
      }

      // Log successful login
      try {
        const ipAddress = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'];
        const userAgent = req.headers['user-agent'];
        await loggingService.logLogin(result.user.id, result.user.email, ipAddress, userAgent);
        console.log('Login logged successfully for user:', result.user.email);
      } catch (logError) {
        console.error('Failed to log successful login:', logError);
      }

      res.json({
        success: true,
        message: 'Login successful',
        user: result.user,
        token: result.token
      });

    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  /**
   * Verify token and get user data
   * GET /api/auth/verify
   */
  async verifyToken(req, res) {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          success: false,
          message: 'Access denied. No token provided.'
        });
      }

      const token = authHeader.split(' ')[1];
      const result = await supabaseAuthService.verifyToken(token);

      if (!result.success) {
        // Handle token refresh scenarios
        if (result.needsRefresh) {
          return res.status(401).json({
            success: false,
            message: result.error || 'Token needs refresh',
            needsRefresh: true
          });
        }
        
        return res.status(401).json({
          success: false,
          message: result.error || 'Invalid token'
        });
      }

      res.json({
        success: true,
        user: result.user
      });

    } catch (error) {
      console.error('Token verification error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  /**
   * Reset password
   * POST /api/auth/reset-password
   */
  async resetPassword(req, res) {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({
          success: false,
          message: 'Email is required'
        });
      }

      const result = await supabaseAuthService.resetPassword(email);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: result.error || 'Password reset failed'
        });
      }

      res.json({
        success: true,
        message: result.message
      });

    } catch (error) {
      console.error('Password reset error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  /**
   * Update user role (admin only)
   * PUT /api/auth/update-role
   */
  async updateUserRole(req, res) {
    try {
      const { userId, role } = req.body;
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      if (!userId || !role) {
        return res.status(400).json({
          success: false,
          message: 'User ID and role are required'
        });
      }

      // Extract admin user ID from token
      const token = authHeader.split(' ')[1];
      const adminVerification = await supabaseAuthService.verifyToken(token);
      
      if (!adminVerification.success) {
        return res.status(401).json({
          success: false,
          message: 'Invalid token'
        });
      }

      const result = await supabaseAuthService.updateUserRole(
        userId, 
        role, 
        adminVerification.user.uid
      );

      if (!result.success) {
        return res.status(403).json({
          success: false,
          message: result.error || 'Role update failed'
        });
      }

      res.json({
        success: true,
        message: 'User role updated successfully',
        user: result.user
      });

    } catch (error) {
      console.error('Role update error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  /**
   * Get user by ID
   * GET /api/auth/user/:id
   */
  async getUserById(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'User ID is required'
        });
      }

      const result = await supabaseAuthService.getUserById(id);

      if (!result.success) {
        return res.status(404).json({
          success: false,
          message: result.error || 'User not found'
        });
      }

      res.json({
        success: true,
        user: result.user
      });

    } catch (error) {
      console.error('Get user error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  /**
   * Test Supabase Auth connection
   * GET /api/auth/test-connection
   */
  async testConnection(req, res) {
    try {
      const result = await supabaseAuthService.testConnection();

      if (!result.success) {
        return res.status(500).json({
          success: false,
          message: 'Supabase Auth connection failed',
          error: result.error
        });
      }

      res.json({
        success: true,
        message: result.message,
        hasActiveSession: result.hasActiveSession
      });

    } catch (error) {
      console.error('Connection test error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }
}

module.exports = new SupabaseAuthController();
