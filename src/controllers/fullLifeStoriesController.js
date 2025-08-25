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
    const { regenerationType, includeAllNotes, notes } = req.body;
    const userId = req.user?.id || 'admin';
    const userName = req.user?.name || req.user?.email || 'Admin User';

    // if notes length is bigger than 1, turn all txt into one string
    let myNote = {}
    if (notes.length > 1) {
      myNote = {
        id: notes[0].id,
        createdAt: new Date().toISOString(),
        text: notes.map(note => note.text).join('\n'),
        author: userName,
        userId
      }
    } else {
      myNote = notes[0];
    }

    console.log('myNote:', myNote);
    // Get the existing story to get session info and notes
    const storyResult = await fullLifeStoriesService.getFullLifeStoryById(id);

    if (!storyResult.success) {
      return res.status(404).json({
        success: false,
        error: 'Full life story not found'
      });
    }

    const story = storyResult.data;

    // Check if there are notes to base regeneration on
    if (!story.review_notes || story.review_notes.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot regenerate without notes or feedback'
      });
    }

    // Get session data for regeneration
    const supabaseService = require('../services/supabaseService');
    const sessionResult = await supabaseService.getSessionById(story.session_id);

    if (!sessionResult.success) {
      return res.status(404).json({
        success: false,
        error: 'Session not found for regeneration'
      });
    }

    const session = sessionResult.data;
    const interviews = session.interviews || [];

    // Get approved drafts for regeneration
    const approvedDrafts = interviews.filter(interview => {
      const draft = interview.ai_draft;
      if (!draft) return false;
      const stage = draft.metadata?.stage || draft.stage;
      return stage === 'approved';
    });

    if (approvedDrafts.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No approved drafts found for regeneration'
      });
    }

    // Use AI service for regeneration with notes feedback
    const aiService = require('../services/aiService');
    console.log('🤖 AI Service: Regenerating full life story with feedback...');

    const fullStoryData = {
      sessionId: story.session_id,
      clientInfo: {
        name: session.client_name,
        age: session.client_age,
        preferences: session.preferences
      },
      approvedDrafts: approvedDrafts.map(interview => ({
        interviewId: interview.id,
        interviewName: interview.name,
        draft: interview.ai_draft,
        transcription: interview.content?.transcription,
        notes: interview.notes,
        duration: interview.duration
      })),
      sessionNotes: session.notes,
      notes: myNote,
      totalInterviews: interviews.length,
      completedInterviews: interviews.filter(i => i.status === 'completed').length,
      // Add regeneration context
      regenerationContext: {
        originalStoryId: story.id,
        originalVersion: story.version,
        feedbackNotes: story.review_notes,
        regenerationType: regenerationType || 'notes_based'
      }
    };

    const regeneratedStory = await aiService.generateFullLifeStory(fullStoryData);

    // Create new version with AI-regenerated content
    // Ensure title is never null by providing a fallback
    const storyTitle = regeneratedStory.title || `Regenerated Life Story for Session ${story.session_id} - ${new Date().toLocaleDateString()}`;
    console.log(`📝 [regenerateFullLifeStory] Using title: "${storyTitle}"`);
    
    const storyData = {
      sessionId: story.session_id,
      title: storyTitle, // Use validated title
      subtitle: regeneratedStory.subtitle,
      content: regeneratedStory.content,
      generatedBy: userName,
      userId: story.user_id,
      sourceMetadata: {
        ...story.source_metadata,
        regeneratedFrom: story.id,
        regenerationType: regenerationType || 'notes_based',
        regenerationNotes: story.review_notes,
        regenerationDate: new Date().toISOString(),
        approvedDrafts: approvedDrafts.length,
        totalInterviews: interviews.length,
        completedInterviews: interviews.filter(i => i.status === 'completed').length,
        approvedDraftIds: approvedDrafts.map(d => d.id),
        sessionData: {
          clientName: session.client_name,
          clientAge: session.client_age,
          sessionStatus: session.status
        }
      },
      generationStats: {
        processingTime: regeneratedStory.metadata?.processingTime || 0,
        aiModel: regeneratedStory.metadata?.aiModel || 'mock-ai-v1.0',
        sourceInterviews: approvedDrafts.length,
        totalWords: regeneratedStory.content?.totalWords || 0,
        estimatedPages: regeneratedStory.content?.estimatedPages || 0,
        regenerated: true,
        originalVersion: story.version
      },
      totalWords: regeneratedStory.content?.totalWords || 0,
      processingTime: regeneratedStory.metadata?.processingTime || 0,
      aiModel: regeneratedStory.metadata?.aiModel || 'mock-ai-v1.0'
    };

    const regenerationResult = await fullLifeStoriesService.createFullLifeStory(storyData);

    if (regenerationResult.success) {

      res.json({
        success: true,
        message: 'Full life story regenerated successfully',
        data: {
          newVersion: regenerationResult.data,
          originalVersion: story,
          regenerationType: regenerationType || 'notes_based'
        }
      });
    } else {
      res.status(500).json({
        success: false,
        error: regenerationResult.error
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
