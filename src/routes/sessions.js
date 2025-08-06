const express = require('express');
const router = express.Router();
const sessionController = require('../controllers/sessionController');

/**
 * @route GET /api/admin/sessions
 * @desc Get all sessions with filtering and pagination
 * @access Admin only
 */
router.get('/', sessionController.getAllSessions);

/**
 * @route GET /api/admin/sessions/:id
 * @desc Get session by ID
 * @access Admin only
 */
router.get('/:id', sessionController.getSessionById);

/**
 * @route POST /api/admin/sessions
 * @desc Create a new session
 * @access Admin only
 */
router.post('/', sessionController.createSession);

/**
 * @route PUT /api/admin/sessions/:id
 * @desc Update session
 * @access Admin only
 */
router.put('/:id', sessionController.updateSession);

/**
 * @route PUT /api/admin/sessions/:id/scheduling
 * @desc Update session scheduling
 * @access Admin only
 */
router.put('/:id/scheduling', sessionController.updateSessionScheduling);

/**
 * @route DELETE /api/admin/sessions/:id
 * @desc Delete session
 * @access Admin only
 */
router.delete('/:id', sessionController.deleteSession);

/**
 * @route POST /api/admin/sessions/:id/interviews
 * @desc Add interview to session
 * @access Admin only
 */
router.post('/:id/interviews', sessionController.addInterviewToSession);

/**
 * @route GET /api/sessions/:id/export/pdf
 * @desc Export session as PDF
 * @access Admin only
 */
router.get('/:id/export/pdf', (req, res) => {
  // Placeholder until we implement the controller
  res.status(501).json({ message: 'Not implemented yet' });
});

/**
 * @route GET /api/sessions/:id/export/json
 * @desc Export session as JSON
 * @access Admin only
 */
router.get('/:id/export/json', (req, res) => {
  // Placeholder until we implement the controller
  res.status(501).json({ message: 'Not implemented yet' });
});

/**
 * @route POST /api/sessions/:id/draft
 * @desc Create a new draft for review
 * @access Admin only
 */
router.post('/:id/draft', (req, res) => {
  // Placeholder until we implement the controller
  res.status(501).json({ message: 'Not implemented yet' });
});

/**
 * @route PUT /api/sessions/:id/draft/:draftId
 * @desc Update draft status
 * @access Admin only
 */
router.put('/:id/draft/:draftId', (req, res) => {
  // Placeholder until we implement the controller
  res.status(501).json({ message: 'Not implemented yet' });
});

module.exports = router;
