const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

/**
 * @route POST /api/auth/register
 * @desc Register a new user
 * @access Public (for regular users), Admin (for admin users)
 */
router.post('/register', authController.register);

/**
 * @route POST /api/auth/login
 * @desc Authenticate user and get token
 * @access Public
 */
router.post('/login', authController.login);

/**
 * @route GET /api/auth/verify
 * @desc Verify token and get user data
 * @access Private
 */
router.get('/verify', authController.verifyToken);

/**
 * @route POST /api/auth/reset-password
 * @desc Request password reset link
 * @access Public
 */
router.post('/reset-password', authController.resetPassword);

/**
 * @route PUT /api/auth/role
 * @desc Update user role
 * @access Admin only
 */
router.put('/role', authController.updateUserRole);

module.exports = router;
