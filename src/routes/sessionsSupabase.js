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
      'audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/aac', 'audio/ogg', 'audio/webm', 'audio/flac',
      'text/plain', 'text/markdown', 'application/pdf', 'application/msword', 
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type'), false);
    }
  }
});

router.post('/interviews/:id/upload', upload.single('file'), sessionController.uploadInterviewFile);

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

module.exports = router;
