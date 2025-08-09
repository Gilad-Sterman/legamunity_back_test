const express = require('express');
const router = express.Router();
const interviewController = require('../controllers/interviewController');
const { verifyToken, requireAdmin } = require('../middleware/auth');
const upload = require('../middleware/upload');

// Import the normalized interview service
const interviewService = require('../services/interviewService');

/**
 * @route GET /api/interviews
 * @desc Get all interviews
 * @access Admin only
 */
router.get('/', interviewController.getAllInterviews);

/**
 * @route GET /api/interviews/session/:sessionId
 * @desc Get all interviews for a specific session (normalized table)
 * @access Admin only
 */
router.get('/session/:sessionId', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const result = await interviewService.getInterviewsBySessionId(sessionId);
    
    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch session interviews',
        error: result.error
      });
    }
    
    res.json({
      success: true,
      data: result.data, // This is the interviews array
      message: 'Session interviews retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching session interviews:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch session interviews',
      error: error.message
    });
  }
});

/**
 * @route POST /api/interviews
 * @desc Create a new interview (normalized table)
 * @access Admin only
 */
router.post('/', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { session_id, ...interviewData } = req.body;
    const result = await interviewService.createInterview(session_id, interviewData);
    
    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to create interview',
        error: result.error
      });
    }
    
    res.status(201).json({
      success: true,
      data: result.data,
      message: 'Interview created successfully'
    });
  } catch (error) {
    console.error('Error creating interview:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create interview',
      error: error.message
    });
  }
});

/**
 * @route PUT /api/interviews/:id
 * @desc Update an interview (normalized table)
 * @access Admin only
 */
router.put('/:id', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    const result = await interviewService.updateInterview(id, updateData);
    
    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to update interview',
        error: result.error
      });
    }
    
    res.json({
      success: true,
      data: result.data,
      message: 'Interview updated successfully'
    });
  } catch (error) {
    console.error('Error updating interview:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update interview',
      error: error.message
    });
  }
});

/**
 * @route DELETE /api/interviews/:id
 * @desc Delete an interview (normalized table)
 * @access Admin only
 */
router.delete('/:id', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await interviewService.deleteInterview(id);
    
    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to delete interview',
        error: result.error
      });
    }
    
    res.json({
      success: true,
      data: result.data,
      message: 'Interview deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting interview:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete interview',
      error: error.message
    });
  }
});

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
