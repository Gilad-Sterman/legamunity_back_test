const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { verifyToken } = require('../middleware/auth');

/**
 * @route GET /api/users
 * @desc Get all users (admin only)
 * @access Admin
 */
// Temporarily disable auth for testing - TODO: Re-enable in production
router.get('/', userController.getAllUsers);

/**
 * @route GET /api/users/profile
 * @desc Get current user's profile
 * @access Private
 */
router.get('/profile', verifyToken, userController.getUserProfile);

/**
 * @route GET /api/users/:uid
 * @desc Get user by ID
 * @access Private
 */
router.get('/:uid', verifyToken, userController.getUserProfile);

/**
 * @route PUT /api/users/profile
 * @desc Update user profile
 * @access Private
 */
router.put('/profile', verifyToken, userController.updateProfile);

/**
 * @route DELETE /api/users/:uid
 * @desc Delete a user
 * @access Private (own account) or Admin (any account)
 */
router.delete('/:uid', verifyToken, userController.deleteUser);

module.exports = router;
