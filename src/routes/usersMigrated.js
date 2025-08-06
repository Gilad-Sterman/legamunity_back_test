const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { createProtectedRoute } = require('../utils/authMigration');

// Create protected route configuration for users endpoints
const usersAuth = createProtectedRoute('/api/users', 'hybrid');

/**
 * MIGRATED USERS ROUTES - Using Hybrid Authentication
 * These routes work with both Firebase and Supabase tokens
 * allowing for gradual migration without breaking existing functionality
 */

/**
 * @route GET /api/users
 * @desc Get all users (admin only)
 * @access Admin (Hybrid: Firebase or Supabase)
 */
router.get('/', usersAuth.authenticateAdmin, userController.getAllUsers);

/**
 * @route GET /api/users/profile
 * @desc Get current user's profile
 * @access Private (Hybrid: Firebase or Supabase)
 */
router.get('/profile', usersAuth.authenticateWithLogging, userController.getUserProfile);

/**
 * @route GET /api/users/:uid
 * @desc Get user by ID
 * @access Private (Hybrid: Firebase or Supabase)
 */
router.get('/:uid', usersAuth.authenticateWithLogging, userController.getUserProfile);

/**
 * @route PUT /api/users/profile
 * @desc Update user profile
 * @access Private (Hybrid: Firebase or Supabase)
 */
router.put('/profile', usersAuth.authenticateWithLogging, userController.updateProfile);

/**
 * @route DELETE /api/users/:uid
 * @desc Delete user (admin only)
 * @access Admin (Hybrid: Firebase or Supabase)
 */
router.delete('/:uid', usersAuth.authenticateAdmin, userController.deleteUser);

/**
 * @route GET /api/users/migration/status
 * @desc Get migration status for monitoring
 * @access Admin
 */
router.get('/migration/status', usersAuth.authenticateAdmin, (req, res) => {
  const { getMigrationStatus } = require('../utils/authMigration');
  const status = getMigrationStatus();
  
  res.json({
    success: true,
    migrationStatus: status,
    routeConfig: usersAuth.getConfig(),
    message: 'Users routes are using hybrid authentication (Firebase + Supabase)'
  });
});

module.exports = router;
