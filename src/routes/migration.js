const express = require('express');
const router = express.Router();
const migrationController = require('../controllers/migrationController');
const draftMigrationController = require('../controllers/draftMigrationController');
const { verifyToken } = require('../middleware/auth');

// All migration routes require admin authentication
router.use(verifyToken);

// Interview migration routes
router.post('/interviews/:sessionId', migrationController.migrateSessionInterviews);
router.post('/interviews/all', migrationController.migrateAllSessionInterviews);
router.get('/interviews/:sessionId/status', migrationController.checkMigrationStatus);
router.post('/interviews/:sessionId/cleanup', migrationController.cleanupSessionPreferences);
router.get('/interviews/overview', migrationController.getMigrationOverview);

// Draft migration routes
router.get('/draft-status', draftMigrationController.getMigrationStatus);
router.post('/migrate-drafts', draftMigrationController.migrateDrafts);

module.exports = router;
