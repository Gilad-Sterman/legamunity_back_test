const express = require('express');
const router = express.Router();
const sessionController = require('../controllers/sessionControllerSupabase');
const { verifyToken, requireAdmin } = require('../middleware/supabaseAuth');

/**
 * Supabase Sessions Routes
 * All routes require admin authentication
 */

// Apply authentication middleware to all routes
router.use(verifyToken);
router.use(requireAdmin);

/**
 * @route GET /api/admin/sessions/stats
 * @desc Get session statistics
 * @access Admin only
 */
router.get('/stats', sessionController.getSessionStats);

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
 * @route POST /api/admin/sessions/:id/interviews
 * @desc Add interview to session
 * @access Admin only
 */
router.post('/:id/interviews', sessionController.addInterviewToSession);

/**
 * @route PUT /api/admin/sessions/interviews/:id
 * @desc Update individual interview
 * @access Admin only
 */
router.put('/interviews/:id', sessionController.updateInterview);

/**
 * @route GET /api/admin/sessions/interviews/:id/status
 * @desc Get interview processing status for real-time updates
 * @access Admin only
 */
router.get('/interviews/:id/status', sessionController.getInterviewStatus);

// Upload file for interview
const multer = require('multer');
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow audio and text files
    const allowedTypes = [
      'audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/aac', 'audio/ogg', 'audio/webm', 'audio/3gp', 'audio/m4a','audio/x-m4a', 'audio/3gpp', 'audio/3gpp2', 'audio/flac',
      'text/plain', 'text/markdown', 'application/pdf', 'application/msword', 
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];

    console.log('File type:', file.mimetype);
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type'), false);
    }
  }
});

router.post('/interviews/:id/upload', upload.single('file'), sessionController.uploadInterviewFile);

/**
 * @route POST /api/admin/sessions/interviews/:id/upload-async
 * @desc Upload file for interview with ASYNC AI processing (no timeout)
 * @access Admin only
 */
router.post('/interviews/:id/upload-async', upload.single('file'), sessionController.uploadInterviewFileAsync);

/**
 * @route POST /api/sessions-supabase/:sessionId/drafts/:draftId/regenerate
 * @desc Regenerate an existing draft with additional notes and instructions
 * @access Admin only
 */
router.post('/:sessionId/drafts/:draftId/regenerate', sessionController.regenerateDraft);

/**
 * @route POST /api/admin/sessions/:id/generate-full-story
 * @desc Generate full life story from all session data and approved drafts
 * @access Admin only
 */
router.post('/:id/generate-full-story', sessionController.generateFullLifeStory);

/**
 * @route GET /api/admin/sessions/:id/full-stories
 * @desc Get all full life stories for a session (with version history)
 * @access Admin only
 */
router.get('/:id/full-stories', sessionController.getSessionFullStories);

/**
 * @route DELETE /api/admin/sessions/:id
 * @desc Delete session
 * @access Admin only
 */
router.delete('/:id', sessionController.deleteSession);

/**
 * @route DELETE /api/admin/sessions/:id/interviews/:interviewId
 * @desc Delete interview from session
 * @access Admin only
 */
router.delete('/:id/interviews/:interviewId', sessionController.deleteInterview);

/**
 * @route GET /api/sessions-supabase/:id/drafts
 * @desc Get all drafts for a specific session
 * @access Admin only
 */
router.get('/:id/drafts', require('../controllers/draftsController').getDraftsBySession);

/**
 * @route POST /api/sessions-supabase/:id/drafts/:draftId/notes
 * @desc Add note to a specific draft
 * @access Admin only
 */
router.post('/:id/drafts/:draftId/notes', verifyToken, require('../controllers/draftsController').addNoteToDraft);

/**
 * @route PUT /api/sessions-supabase/:id/drafts/:draftId/stage
 * @desc Update draft stage (approve/reject)
 * @access Admin only
 */
router.put('/:id/drafts/:draftId/stage', verifyToken, require('../controllers/draftsController').updateDraftStage);

module.exports = router;
