const express = require('express');
const router = express.Router();
const supabaseAuthController = require('../controllers/supabaseAuthController');

/**
 * Supabase Authentication Routes
 * These routes mirror the Firebase auth routes for seamless migration
 * Prefix: /api/supabase-auth
 */

/**
 * @route GET /api/supabase-auth/test-connection
 * @desc Test Supabase Auth connection
 * @access Public
 */
router.get('/test-connection', supabaseAuthController.testConnection);

/**
 * @route POST /api/supabase-auth/register
 * @desc Register a new user
 * @access Public (for regular users), Admin (for admin users)
 */
router.post('/register', supabaseAuthController.register);

/**
 * @route POST /api/supabase-auth/login
 * @desc Authenticate user and get token
 * @access Public
 */
router.post('/login', supabaseAuthController.login);

/**
 * @route GET /api/supabase-auth/verify
 * @desc Verify token and get user data
 * @access Private
 */
router.get('/verify', supabaseAuthController.verifyToken);

/**
 * @route POST /api/supabase-auth/reset-password
 * @desc Request password reset link
 * @access Public
 */
router.post('/reset-password', supabaseAuthController.resetPassword);

/**
 * @route PUT /api/supabase-auth/update-role
 * @desc Update user role (admin only)
 * @access Private (Admin only)
 */
router.put('/update-role', supabaseAuthController.updateUserRole);

/**
 * @route GET /api/supabase-auth/user/:id
 * @desc Get user by ID
 * @access Private
 */
router.get('/user/:id', supabaseAuthController.getUserById);

module.exports = router;
