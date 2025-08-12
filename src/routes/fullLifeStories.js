const express = require('express');
const router = express.Router();
const fullLifeStoriesController = require('../controllers/fullLifeStoriesController');
const { verifyToken, requireAdmin } = require('../middleware/supabaseAuth');

/**
 * Full Life Stories Routes
 * All routes require admin authentication
 */

// Apply authentication middleware to all routes
router.use(verifyToken);
router.use(requireAdmin);

/**
 * @route GET /api/admin/full-life-stories
 * @desc Get all full life stories with filtering and pagination
 * @access Admin only
 */
router.get('/', fullLifeStoriesController.getAllFullLifeStories);

/**
 * @route GET /api/admin/full-life-stories/stats
 * @desc Get full life stories statistics
 * @access Admin only
 */
router.get('/stats', fullLifeStoriesController.getFullLifeStoriesStats);

/**
 * @route GET /api/admin/full-life-stories/:id
 * @desc Get full life story by ID
 * @access Admin only
 */
router.get('/:id', fullLifeStoriesController.getFullLifeStoryById);

/**
 * @route PUT /api/admin/full-life-stories/:id/status
 * @desc Update full life story status (approve/reject)
 * @access Admin only
 */
router.put('/:id/status', fullLifeStoriesController.updateFullLifeStoryStatus);

/**
 * @route POST /api/admin/full-life-stories/:id/notes
 * @desc Add note to full life story
 * @access Admin only
 */
router.post('/:id/notes', fullLifeStoriesController.addNoteToFullLifeStory);

/**
 * @route POST /api/admin/full-life-stories/:id/regenerate
 * @desc Regenerate full life story
 * @access Admin only
 */
router.post('/:id/regenerate', fullLifeStoriesController.regenerateFullLifeStory);

/**
 * @route DELETE /api/admin/full-life-stories/:id
 * @desc Archive full life story (soft delete)
 * @access Admin only
 */
router.delete('/:id', fullLifeStoriesController.archiveFullLifeStory);

module.exports = router;
