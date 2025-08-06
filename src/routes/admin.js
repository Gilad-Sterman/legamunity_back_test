const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const sessionController = require('../controllers/sessionController');
const draftsController = require('../controllers/draftsController');
const { verifyToken, requireAdmin } = require('../middleware/auth');

// All routes in this file are protected and require admin privileges
router.use(verifyToken, requireAdmin);

/**
 * @route   GET /api/admin/users
 * @desc    Get all users with optional search
 * @access  Admin
 */
router.get('/users', adminController.listUsers);

/**
 * @route   PUT /api/admin/users/:uid/toggle-status
 * @desc    Toggle a user's disabled status
 * @access  Admin
 */
router.put('/users/:uid/toggle-status', adminController.toggleUserStatus);

/**
 * @route   DELETE /api/admin/users/:uid
 * @desc    Delete a user
 * @access  Admin
 */
router.delete('/users/:uid', adminController.deleteUser);

/**
 * @route   PUT /api/admin/users/:uid/display-name
 * @desc    Update a user's display name
 * @access  Admin
 */
router.put('/users/:uid/display-name', adminController.updateUserDisplayName);

// Sessions management routes
/**
 * @route   GET /api/admin/sessions
 * @desc    Get all sessions with filtering and pagination
 * @access  Admin
 */
router.get('/sessions', sessionController.getAllSessions);

/**
 * @route   GET /api/admin/sessions/:id
 * @desc    Get session by ID
 * @access  Admin
 */
router.get('/sessions/:id', sessionController.getSessionById);

/**
 * @route   POST /api/admin/sessions
 * @desc    Create a new session
 * @access  Admin
 */
router.post('/sessions', sessionController.createSession);

/**
 * @route   PUT /api/admin/sessions/:id
 * @desc    Update session
 * @access  Admin
 */
router.put('/sessions/:id', sessionController.updateSession);

/**
 * @route   DELETE /api/admin/sessions/:id
 * @desc    Delete session
 * @access  Admin
 */
router.delete('/sessions/:id', sessionController.deleteSession);

/**
 * @route   POST /api/admin/sessions/:id/interviews
 * @desc    Add interview to session
 * @access  Admin
 */
router.post('/sessions/:id/interviews', sessionController.addInterviewToSession);

/**
 * @route   PUT /api/admin/sessions/:id/scheduling
 * @desc    Update session scheduling
 * @access  Admin
 */
router.put('/sessions/:id/scheduling', sessionController.updateSessionScheduling);

// Drafts management routes
/**
 * @route   GET /api/admin/drafts
 * @desc    Get all drafts with filtering and pagination
 * @access  Admin
 */
router.get('/drafts', draftsController.getAllDrafts);

/**
 * @route   GET /api/admin/drafts/:id
 * @desc    Get draft by ID
 * @access  Admin
 */
router.get('/drafts/:id', draftsController.getDraftById);

/**
 * @route   PUT /api/admin/drafts/:id
 * @desc    Update draft content
 * @access  Admin
 */
router.put('/drafts/:id', draftsController.updateDraftContent);

/**
 * @route   PUT /api/admin/drafts/:id/stage
 * @desc    Update draft stage
 * @access  Admin
 */
router.put('/drafts/:id/stage', draftsController.updateDraftStage);

/**
 * @route   POST /api/admin/drafts/:id/export
 * @desc    Export draft
 * @access  Admin
 */
router.post('/drafts/:id/export', draftsController.exportDraft);

/**
 * @route   GET /api/admin/drafts/:id/history
 * @desc    Get draft history
 * @access  Admin
 */
router.get('/drafts/:id/history', draftsController.getDraftHistory);

module.exports = router;
