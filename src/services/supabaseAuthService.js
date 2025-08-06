const supabase = require('../config/database');
const jwt = require('jsonwebtoken');
const config = require('../config/config');

class SupabaseAuthService {
  
  /**
   * Register a new user with Supabase Auth
   */
  async registerUser(email, password, userData = {}) {
    try {
      // Register user with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: userData.displayName || '',
            role: userData.role || 'user'
          }
        }
      });

      if (authError) {
        throw new Error(authError.message);
      }

      // If user was created successfully, add to our users table
      if (authData.user) {
        const { data: userRecord, error: dbError } = await supabase
          .from('users')
          .insert([{
            id: authData.user.id, // Use Supabase Auth user ID
            email: authData.user.email,
            name: userData.displayName || '',
            role: userData.role || 'user',
            phone: userData.phone || null
          }])
          .select()
          .single();

        if (dbError) {
          console.error('Error creating user record:', dbError);
          // Don't throw here - auth user was created successfully
        }

        // Generate our own JWT token
        const token = this.generateToken({
          uid: authData.user.id,
          email: authData.user.email,
          role: userData.role || 'user'
        });

        return {
          success: true,
          user: {
            uid: authData.user.id,
            email: authData.user.email,
            displayName: userData.displayName || '',
            role: userData.role || 'user'
          },
          token,
          needsEmailVerification: !authData.user.email_confirmed_at
        };
      }

      throw new Error('User registration failed');

    } catch (error) {
      console.error('Registration error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Login user with email and password
   */
  async loginUser(email, password) {
    try {
      // Sign in with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (authError) {
        // Provide more specific error messages
        if (authError.message.includes('Email not confirmed')) {
          throw new Error('Email verification required. Please check your email and click the verification link.');
        }
        if (authError.message.includes('Invalid login credentials')) {
          throw new Error('Invalid email or password.');
        }
        throw new Error(authError.message);
      }

      if (!authData.user) {
        throw new Error('Login failed - no user data');
      }

      // Get user details from our users table
      const { data: userRecord, error: dbError } = await supabase
        .from('users')
        .select('*')
        .eq('id', authData.user.id)
        .single();

      let userRole = 'user';
      let displayName = '';

      if (!dbError && userRecord) {
        userRole = userRecord.role;
        displayName = userRecord.name;
      } else {
        // Fallback to auth metadata if user not in our table
        userRole = authData.user.user_metadata?.role || 'user';
        displayName = authData.user.user_metadata?.display_name || '';
      }

      // Generate our own JWT token
      const token = this.generateToken({
        uid: authData.user.id,
        email: authData.user.email,
        role: userRole
      });

      return {
        success: true,
        user: {
          uid: authData.user.id,
          email: authData.user.email,
          displayName,
          role: userRole
        },
        token
      };

    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Verify JWT token and get user data
   */
  async verifyToken(token) {
    try {
      // Verify our JWT token
      const decoded = jwt.verify(token, config.jwtSecret);
      
      // Get fresh user data from database
      const { data: userRecord, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', decoded.uid)
        .single();

      if (error || !userRecord) {
        throw new Error('User not found');
      }

      return {
        success: true,
        user: {
          uid: userRecord.id,
          email: userRecord.email,
          displayName: userRecord.name,
          role: userRecord.role
        }
      };

    } catch (error) {
      console.error('Token verification error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Reset password
   */
  async resetPassword(email) {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password`
      });

      if (error) {
        throw new Error(error.message);
      }

      return {
        success: true,
        message: 'Password reset email sent'
      };

    } catch (error) {
      console.error('Password reset error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Update user role (admin only)
   */
  async updateUserRole(userId, newRole, adminUserId) {
    try {
      // Verify admin user
      const { data: adminUser, error: adminError } = await supabase
        .from('users')
        .select('role')
        .eq('id', adminUserId)
        .single();

      if (adminError || !adminUser || adminUser.role !== 'admin') {
        throw new Error('Unauthorized - admin access required');
      }

      // Update user role in our database
      const { data: updatedUser, error: updateError } = await supabase
        .from('users')
        .update({ role: newRole, updated_at: new Date().toISOString() })
        .eq('id', userId)
        .select()
        .single();

      if (updateError) {
        throw new Error(updateError.message);
      }

      // Update user metadata in Supabase Auth
      const { error: metadataError } = await supabase.auth.admin.updateUserById(
        userId,
        {
          user_metadata: { role: newRole }
        }
      );

      if (metadataError) {
        console.warn('Failed to update auth metadata:', metadataError.message);
        // Don't fail the request - database update succeeded
      }

      return {
        success: true,
        user: updatedUser
      };

    } catch (error) {
      console.error('Role update error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(userId) {
    try {
      const { data: userRecord, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        throw new Error(error.message);
      }

      return {
        success: true,
        user: {
          uid: userRecord.id,
          email: userRecord.email,
          displayName: userRecord.name,
          role: userRecord.role,
          phone: userRecord.phone,
          createdAt: userRecord.created_at
        }
      };

    } catch (error) {
      console.error('Get user error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Generate JWT token (same as Firebase implementation)
   */
  generateToken(user) {
    return jwt.sign(
      {
        uid: user.uid,
        email: user.email,
        role: user.role || 'user'
      },
      config.jwtSecret,
      { expiresIn: '1d' }
    );
  }

  /**
   * Test Supabase Auth connection
   */
  async testConnection() {
    try {
      // Try to get the current session (will be null if no active session)
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        throw new Error(error.message);
      }

      return {
        success: true,
        message: 'Supabase Auth connection successful',
        hasActiveSession: !!session
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = new SupabaseAuthService();
