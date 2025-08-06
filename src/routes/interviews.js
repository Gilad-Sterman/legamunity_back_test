const express = require('express');
const router = express.Router();
const interviewController = require('../controllers/interviewController');
const { verifyToken, requireAdmin } = require('../middleware/auth');
const upload = require('../middleware/upload');

/**
 * @route GET /api/interviews
 * @desc Get all interviews
 * @access Admin only
 */
router.get('/', interviewController.getAllInterviews);

/**
 * @route GET /api/interviews/:id
 * @desc Get interview by ID
 * @access Admin only
 */
router.get('/:id', interviewController.getInterviewById);

/**
 * @route POST /api/interviews/:id/start
 * @desc Start an interview
 * @access Admin only
 */
router.post('/:id/start', interviewController.startInterview);

/**
 * @route POST /api/interviews/:id/complete
 * @desc Complete an interview (triggers auto-draft creation)
 * @access Admin only
 */
router.post('/:id/complete', interviewController.completeInterview);

/**
 * @route PUT /api/interviews/:id/content
 * @desc Update interview content during session
 * @access Admin only
 */
router.put('/:id/content', interviewController.updateInterviewContent);

/**
 * @route PUT /api/interviews/:id
 * @desc Update interview details (name, notes, etc.)
 * @access Admin only
 */
router.put('/:id', interviewController.updateInterview);

/**
 * @route POST /api/interviews/:interviewId/upload
 * @desc Upload file for interview and process with AI
 * @access Admin only
 */
router.post('/:interviewId/upload', verifyToken, requireAdmin, upload.single('file'), interviewController.uploadInterviewFile);

/**
 * @route POST /api/interviews/:id/question
 * @desc Save question and answer during interview
 * @access Admin only
 */
router.post('/:id/question', (req, res) => {
  // Placeholder until we implement the controller
  res.status(501).json({ message: 'Not implemented yet' });
});

/**
 * @route POST /api/interviews/:id/complete
 * @desc Mark interview as complete
 * @access Admin only
 */
router.post('/:id/complete', (req, res) => {
  // Placeholder until we implement the controller
  res.status(501).json({ message: 'Not implemented yet' });
});

/**
 * @route POST /api/interviews/:id/friend
 * @desc Invite friend for interview verification
 * @access Admin only
 */
router.post('/:id/friend', (req, res) => {
  // Placeholder until we implement the controller
  res.status(501).json({ message: 'Not implemented yet' });
});

/**
 * @route GET /api/interviews/:id/conflicts
 * @desc Get conflicts for an interview
 * @access Admin only
 */
router.get('/:id/conflicts', (req, res) => {
  // Placeholder until we implement the controller
  res.status(501).json({ message: 'Not implemented yet' });
});

/**
 * @route PUT /api/interviews/:id/conflicts/:conflictId
 * @desc Resolve a conflict
 * @access Admin only
 */
router.put('/:id/conflicts/:conflictId', (req, res) => {
  // Placeholder until we implement the controller
  res.status(501).json({ message: 'Not implemented yet' });
});

module.exports = router;
