const express = require('express');
const router = express.Router();
const supabaseSessionController = require('../controllers/supabaseSessionController');

// ==================== CONNECTION TESTING ====================
router.get('/test-connection', supabaseSessionController.testConnection);

// ==================== USERS ====================
router.get('/users', supabaseSessionController.getUsers);

// ==================== SESSIONS ====================
router.post('/sessions', supabaseSessionController.createSession);
router.get('/sessions', supabaseSessionController.getSessions);
router.get('/sessions/:id', supabaseSessionController.getSessionById);

// ==================== INTERVIEWS ====================
router.post('/sessions/:id/interviews', supabaseSessionController.scheduleInterview);

module.exports = router;
