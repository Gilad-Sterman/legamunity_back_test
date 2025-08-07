const express = require('express');
const router = express.Router();
const logsController = require('../controllers/logsController');
const { verifyToken, requireAdmin } = require('../middleware/auth');

// All log routes require authentication and admin privileges
router.use(verifyToken);
router.use(requireAdmin);

// GET /api/logs - Get logs with filtering and pagination
router.get('/', logsController.getLogs);

// GET /api/logs/stats - Get log statistics
router.get('/stats', logsController.getLogStats);

// GET /api/logs/errors - Get recent error logs
router.get('/errors', logsController.getRecentErrors);

// GET /api/logs/health - Get system health data
router.get('/health', logsController.getSystemHealth);

// GET /api/logs/user/:userId - Get user activity logs
router.get('/user/:userId', logsController.getUserActivity);

// GET /api/logs/session/:sessionId - Get session-related logs
router.get('/session/:sessionId', logsController.getSessionLogs);

// POST /api/logs - Create manual log entry (for testing/special cases)
router.post('/', logsController.createLog);

module.exports = router;
