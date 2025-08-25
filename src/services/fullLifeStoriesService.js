/**
 * Full Life Stories Service
 * Handles all operations related to full life stories with versioning
 */

const supabase = require('../config/database');

/**
 * Create a new full life story (with automatic versioning)
 * @param {Object} storyData - Full life story data
 * @returns {Promise<Object>} - Result with success status and data
 */
const createFullLifeStory = async (storyData) => {
  try {
    const {
      sessionId,
      title,
      subtitle,
      content,
      generatedBy,
      userId,
      sourceMetadata,
      generationStats,
      totalWords,
      processingTime,
      aiModel
    } = storyData;

    console.log('📚 Creating full life story for session:', sessionId);
    
    // Ensure title is never null by providing a fallback
    const validatedTitle = title || `Life Story for Session ${sessionId} - ${new Date().toLocaleDateString()}`;
    
    // Ensure content is never null by providing a fallback
    const validatedContent = content || {
      fullText: `This is a placeholder for the life story content. Generated on ${new Date().toLocaleDateString()}.`,
      chapters: [],
      metadata: {
        generatedAt: new Date().toISOString(),
        wordCount: 0
      }
    };
    
    // First, mark any existing current version as not current
    await supabase
      .from('full_life_stories')
      .update({ is_current_version: false })
      .eq('session_id', sessionId)
      .eq('is_current_version', true);

    // Get the next version number
    const { data: existingVersions } = await supabase
      .from('full_life_stories')
      .select('version')
      .eq('session_id', sessionId)
      .order('version', { ascending: false })
      .limit(1);

    const nextVersion = existingVersions && existingVersions.length > 0 
      ? existingVersions[0].version + 1 
      : 1;

    // Direct insert without using RLS function
    const { data, error } = await supabase
      .from('full_life_stories')
      .insert({
        session_id: sessionId,
        version: nextVersion,
        is_current_version: true,
        title: validatedTitle, // Use validated title that's guaranteed not to be null
        subtitle,
        content: validatedContent, // Use validated content
        generated_by: generatedBy,
        user_id: userId,
        source_metadata: sourceMetadata,
        generation_stats: generationStats,
        total_words: totalWords,
        total_pages: Math.ceil((totalWords || 0) / 250),
        estimated_reading_time: Math.ceil((totalWords || 0) / 200),
        processing_time: processingTime,
        ai_model: aiModel,
        status: 'generated'
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Error creating full life story:', error);
      return {
        success: false,
        error: error.message
      };
    }
    
    console.log('✅ Full life story created successfully:', data.id);
    return {
      success: true,
      data: data
    };

  } catch (error) {
    console.error('❌ Error in createFullLifeStory:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Get full life story by ID
 * @param {string} storyId - Full life story ID
 * @returns {Promise<Object>} - Result with success status and data
 */
const getFullLifeStoryById = async (storyId) => {
  try {
    const { data, error } = await supabase
      .from('full_life_stories')
      .select('*')
      .eq('id', storyId)
      .single();

    if (error) {
      console.error('❌ Error fetching full life story:', error);
      return {
        success: false,
        error: error.message
      };
    }

    return {
      success: true,
      data: data
    };

  } catch (error) {
    console.error('❌ Error in getFullLifeStoryById:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Get all full life stories for a session (with version history)
 * @param {string} sessionId - Session ID
 * @returns {Promise<Object>} - Result with success status and data array
 */
const getFullLifeStoriesBySession = async (sessionId) => {
  try {
    const { data, error } = await supabase
      .from('full_life_stories')
      .select(`
        *,
        sessions (
          id,
          client_name,
          client_age,
          status
        )
      `)
      .eq('session_id', sessionId)
      .order('version', { ascending: false });

    if (error) {
      console.error('❌ Error fetching full life stories for session:', error);
      return {
        success: false,
        error: error.message
      };
    }

    return {
      success: true,
      data: data || []
    };

  } catch (error) {
    console.error('❌ Error in getFullLifeStoriesBySession:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Get current version of full life story for a session
 * @param {string} sessionId - Session ID
 * @returns {Promise<Object>} - Result with success status and data
 */
const getCurrentFullLifeStory = async (sessionId) => {
  try {
    const { data, error } = await supabase
      .from('full_life_stories')
      .select(`
        *,
        sessions (
          id,
          client_name,
          client_age,
          status
        )
      `)
      .eq('session_id', sessionId)
      .eq('is_current_version', true)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No current version found
        return {
          success: true,
          data: null
        };
      }
      console.error('❌ Error fetching current full life story:', error);
      return {
        success: false,
        error: error.message
      };
    }

    return {
      success: true,
      data
    };

  } catch (error) {
    console.error('❌ Error in getCurrentFullLifeStory:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Update full life story status (for review workflow)
 * @param {string} storyId - Story ID
 * @param {Object} updateData - Update data
 * @returns {Promise<Object>} - Result with success status and data
 */
const updateFullLifeStoryStatus = async (storyId, updateData) => {
  try {
    const { status, reason, userId, isRejection } = updateData;
    const timestamp = new Date().toISOString();
    
    // Prepare the update object with only valid database fields
    const updateObject = {
      status,
      updated_at: timestamp
    };

    // If there's a reason, store it in review_notes with proper formatting
    if (reason) {
      const userName = userId || 'Admin';
      const actionText = isRejection ? 'Rejected' : status === 'approved' ? 'Approved' : 'Updated';
      const noteEntry = `[${timestamp}] ${userName}: ${actionText} - ${reason}`;
      
      updateObject.review_notes = noteEntry;
      updateObject.reviewed_by = userName;
      updateObject.reviewed_at = timestamp;
    }

    const { data, error } = await supabase
      .from('full_life_stories')
      .update(updateObject)
      .eq('id', storyId)
      .select(`
        *,
        sessions (
          id,
          client_name,
          client_age,
          status,
          created_at
        )
      `)
      .single();

    if (error) {
      console.error('❌ Error updating full life story status:', error);
      return {
        success: false,
        error: error.message
      };
    }

    return {
      success: true,
      data
    };

  } catch (error) {
    console.error('❌ Error in updateFullLifeStoryStatus:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Update full life story review notes
 * @param {string} storyId - Story ID
 * @param {string} reviewNotes - Updated review notes
 * @param {string} reviewedBy - User who added the notes
 * @returns {Promise<Object>} - Result with success status and updated story
 */
const updateFullLifeStoryReviewNotes = async (storyId, reviewNotes, reviewedBy) => {
  try {
    const { data, error } = await supabase
      .from('full_life_stories')
      .update({
        review_notes: [],
        reviewed_by: reviewedBy,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', storyId)
      .select(`
        *,
        sessions (
          id,
          client_name,
          client_age,
          status,
          created_at
        )
      `)
      .single();

    if (error) {
      console.error('❌ Error updating full life story review notes:', error);
      return {
        success: false,
        error: error.message
      };
    }

    return {
      success: true,
      data
    };

  } catch (error) {
    console.error('❌ Error in updateFullLifeStoryReviewNotes:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Delete full life story (soft delete by archiving)
 * @param {string} storyId - Story ID
 * @returns {Promise<Object>} - Result with success status
 */
const archiveFullLifeStory = async (storyId) => {
  try {
    const { error } = await supabase
      .from('full_life_stories')
      .update({
        status: 'archived',
        updated_at: new Date().toISOString()
      })
      .eq('id', storyId);

    if (error) {
      console.error('❌ Error archiving full life story:', error);
      return {
        success: false,
        error: error.message
      };
    }

    return {
      success: true
    };

  } catch (error) {
    console.error('❌ Error in archiveFullLifeStory:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Get all full life stories across all sessions (current versions only by default)
 * @param {Object} options - Query options
 * @param {boolean} options.currentVersionsOnly - Only return current versions (default: true)
 * @param {string} options.status - Filter by status
 * @param {string} options.sortBy - Sort field (default: 'generated_at')
 * @param {string} options.sortOrder - Sort order 'asc' or 'desc' (default: 'desc')
 * @param {number} options.limit - Limit results
 * @param {number} options.offset - Offset for pagination
 * @returns {Promise<Object>} - Result with success status and data array
 */
const getAllFullLifeStories = async (options = {}) => {
  try {
    const {
      currentVersionsOnly = true,
      status,
      sortBy = 'generated_at',
      sortOrder = 'desc',
      limit,
      offset
    } = options;

    let query = supabase
      .from('full_life_stories')
      .select(`
        *,
        sessions (
          id,
          client_name,
          client_age,
          status,
          created_at
        )
      `);

    // Filter by current versions only
    if (currentVersionsOnly) {
      query = query.eq('is_current_version', true);
    }

    // Filter by status
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    // Apply sorting
    query = query.order(sortBy, { ascending: sortOrder === 'asc' });

    // Apply pagination
    if (limit) {
      query = query.limit(limit);
    }
    if (offset) {
      query = query.range(offset, offset + (limit || 50) - 1);
    }

    const { data, error } = await query;

    if (error) {
      console.error('❌ Error fetching all full life stories:', error);
      return {
        success: false,
        error: error.message
      };
    }

    return {
      success: true,
      data: data || []
    };

  } catch (error) {
    console.error('❌ Error in getAllFullLifeStories:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Get full life stories statistics
 * @returns {Promise<Object>} - Result with success status and stats
 */
const getFullLifeStoriesStats = async () => {
  try {
    const { data, error } = await supabase
      .from('full_life_stories')
      .select(`
        id,
        status,
        total_words,
        total_pages,
        generated_at,
        is_current_version
      `);

    if (error) {
      console.error('❌ Error fetching full life stories stats:', error);
      return {
        success: false,
        error: error.message
      };
    }

    const stats = {
      totalStories: data.length,
      currentVersions: data.filter(s => s.is_current_version).length,
      byStatus: data.reduce((acc, story) => {
        acc[story.status] = (acc[story.status] || 0) + 1;
        return acc;
      }, {}),
      totalWords: data.reduce((sum, story) => sum + (story.total_words || 0), 0),
      totalPages: data.reduce((sum, story) => sum + (story.total_pages || 0), 0),
      averageWords: data.length > 0 ? Math.round(data.reduce((sum, story) => sum + (story.total_words || 0), 0) / data.length) : 0
    };

    return {
      success: true,
      data: stats
    };

  } catch (error) {
    console.error('❌ Error in getFullLifeStoriesStats:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

module.exports = {
  createFullLifeStory,
  getFullLifeStoryById,
  getFullLifeStoriesBySession,
  getAllFullLifeStories,
  getCurrentFullLifeStory,
  updateFullLifeStoryStatus,
  updateFullLifeStoryReviewNotes,
  archiveFullLifeStory,
  getFullLifeStoriesStats
};
