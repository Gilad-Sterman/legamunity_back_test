const fullLifeStoriesService = require('../services/fullLifeStoriesService');

/**
 * Full Life Stories Controller
 * Handles HTTP requests for full life stories management
 */

/**
 * Get all full life stories with filtering and pagination
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getAllFullLifeStories = async (req, res) => {
  try {
    const {
      status,
      sortBy,
      sortOrder,
      limit,
      offset,
      currentVersionsOnly
    } = req.query;

    const options = {
      status,
      sortBy,
      sortOrder,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
      currentVersionsOnly: currentVersionsOnly !== 'false' // Default to true unless explicitly false
    };

    const result = await fullLifeStoriesService.getAllFullLifeStories(options);

    if (result.success) {
      res.json({
        success: true,
        data: result.data,
        total: result.data.length
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error('❌ Error in getAllFullLifeStories controller:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Get full life stories statistics
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getFullLifeStoriesStats = async (req, res) => {
  try {
    const result = await fullLifeStoriesService.getFullLifeStoriesStats();

    if (result.success) {
      res.json({
        success: true,
        data: result.data
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error('❌ Error in getFullLifeStoriesStats controller:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Get full life story by ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getFullLifeStoryById = async (req, res) => {
  try {
    const { id } = req.params;

    console.log('📖 Fetching full life story by ID:', id);

    const result = await fullLifeStoriesService.getFullLifeStoryById(id);

    if (result.success) {
      res.json({
        success: true,
        data: result.data
      });
    } else {
      res.status(404).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error('❌ Error in getFullLifeStoryById controller:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Update full life story status (approve/reject)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const updateFullLifeStoryStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reason } = req.body;
    const userId = req.user?.email || req.user?.name || 'admin';



    // Check if this is a rejection - we'll handle it specially since DB doesn't support 'rejected' status
    const isRejection = status === 'rejected';
    const actualStatus = isRejection ? 'generated' : status; // Keep as 'generated' for rejections
    
    if (!status || !['approved', 'rejected', 'generated', 'archived'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Valid status is required (approved, rejected, generated, archived)'
      });
    }

    const result = await fullLifeStoriesService.updateFullLifeStoryStatus(id, {
      status: actualStatus, // Use the database-compatible status
      reason,
      userId,
      isRejection // Pass rejection flag to service
    });

    if (result.success) {
      res.json({
        success: true,
        data: result.data
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error('❌ Error in updateFullLifeStoryStatus controller:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Add note to full life story
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const addNoteToFullLifeStory = async (req, res) => {
  try {
    const { id } = req.params;
    const { text } = req.body;
    const userId = req.user?.id || 'admin';
    const userName = req.user?.name || req.user?.email || 'Admin User';



    if (!text || text.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Note text is required'
      });
    }

    // Get the existing story first
    const storyResult = await fullLifeStoriesService.getFullLifeStoryById(id);
    
    if (!storyResult.success) {
      return res.status(404).json({
        success: false,
        error: 'Full life story not found'
      });
    }

    // Update the story with the new note in review_notes field
    const currentNotes = storyResult.data.review_notes || '';
    const timestamp = new Date().toISOString();
    const noteEntry = `[${timestamp}] ${userName}: ${text.trim()}`;
    const updatedNotes = currentNotes ? `${currentNotes}\n\n${noteEntry}` : noteEntry;

    // Update the story in database
    const updateResult = await fullLifeStoriesService.updateFullLifeStoryReviewNotes(id, updatedNotes, userName);
    
    if (!updateResult.success) {
      return res.status(500).json({
        success: false,
        error: 'Failed to save note'
      });
    }

    const newNote = {
      id: Date.now(),
      text: text.trim(),
      createdAt: timestamp,
      author: userName,
      userId
    };

    res.json({
      success: true,
      data: {
        note: newNote,
        story: updateResult.data
      }
    });

  } catch (error) {
    console.error('❌ Error in addNoteToFullLifeStory controller:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Regenerate full life story
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const regenerateFullLifeStory = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || 'admin';



    // Get the existing story to get session info
    const storyResult = await fullLifeStoriesService.getFullLifeStoryById(id);
    
    if (!storyResult.success) {
      return res.status(404).json({
        success: false,
        error: 'Full life story not found'
      });
    }

    const story = storyResult.data;

    // For now, we'll simulate regeneration by updating the status
    // In a real implementation, you'd trigger the AI generation process
    const updateResult = await fullLifeStoriesService.updateFullLifeStoryStatus(id, {
      status: 'pending_approval',
      reason: 'Story regenerated',
      userId
    });

    if (updateResult.success) {
      res.json({
        success: true,
        message: 'Full life story regeneration initiated',
        data: updateResult.data
      });
    } else {
      res.status(500).json({
        success: false,
        error: updateResult.error
      });
    }

  } catch (error) {
    console.error('❌ Error in regenerateFullLifeStory controller:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Archive full life story (soft delete)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const archiveFullLifeStory = async (req, res) => {
  try {
    const { id } = req.params;

    console.log('🗄️ Archiving full life story:', id);

    const result = await fullLifeStoriesService.archiveFullLifeStory(id);

    if (result.success) {
      res.json({
        success: true,
        message: 'Full life story archived successfully'
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error('❌ Error in archiveFullLifeStory controller:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

module.exports = {
  getAllFullLifeStories,
  getFullLifeStoriesStats,
  getFullLifeStoryById,
  updateFullLifeStoryStatus,
  addNoteToFullLifeStory,
  regenerateFullLifeStory,
  archiveFullLifeStory
};
