const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhookController');

/**
 * Webhook Routes for AI Processing Callbacks
 * These endpoints receive callbacks from n8n AI workflow
 * No authentication required for webhooks (but should validate source in production)
 */

/**
 * @route GET /api/webhooks/health
 * @desc Health check for webhook endpoints
 * @access Public
 */
router.get('/health', webhookController.webhookHealthCheck);

/**
 * @route POST /api/webhooks/transcription-complete
 * @desc Handle transcription completion callback from n8n AI workflow
 * @access Public (with validation)
 * @body {
 *   interviewId: string,
 *   transcription: string,
 *   success: boolean,
 *   error?: string,
 *   metadata?: object
 * }
 */
router.post('/transcription-complete', webhookController.handleTranscriptionWebhook);

/**
 * @route POST /api/webhooks/draft-complete
 * @desc Handle draft generation completion callback from n8n AI workflow
 * @access Public (with validation)
 * @body {
 *   interviewId: string,
 *   draft: object,
 *   success: boolean,
 *   error?: string,
 *   metadata?: object
 * }
 */
router.post('/draft-complete', webhookController.handleDraftWebhook);

/**
 * @route POST /api/webhooks/life-story-complete
 * @desc Handle life story generation completion callback from n8n AI workflow
 * @access Public (with validation)
 * @body {
 *   interviewId: string,
 *   lifeStory: object,
 *   success: boolean,
 *   error?: string,
 *   metadata?: object
 * }
 */
router.post('/life-story-complete', webhookController.handleLifeStoryWebhook);

module.exports = router;
