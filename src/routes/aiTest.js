/**
 * AI Test Routes
 * Routes for testing AI service integration
 */

const express = require('express');
const router = express.Router();
const aiTestController = require('../controllers/aiTestController');

// Health check and configuration
router.get('/health', aiTestController.healthCheck);
router.post('/config', aiTestController.updateConfig);

// Individual function tests
router.post('/test-transcribe', aiTestController.testTranscribe);
router.post('/test-process', aiTestController.testProcess);
router.post('/test-generate', aiTestController.testGenerate);

// Complete workflow test
router.post('/test-workflow', aiTestController.testWorkflow);

// Recordings endpoint test
router.post('/test-recordings', aiTestController.testRecordingsEndpoint);
router.post('/test-recordings-variations', aiTestController.testRecordingsVariations);
router.post('/test-n8n-patterns', aiTestController.testN8nPatterns);
router.post('/test-direct-n8n-url', aiTestController.testDirectN8nUrl);
router.post('/test-n8n-test-url', aiTestController.testN8nTestUrl);

module.exports = router;
