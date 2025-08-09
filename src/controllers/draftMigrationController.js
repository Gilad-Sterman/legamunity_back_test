const supabase = require('../config/database');

/**
 * Draft Migration Controller
 * Migrates draft content from interviews table to drafts table
 */

/**
 * @desc    Migrate all drafts from interviews table to drafts table
 * @route   POST /api/migration/migrate-drafts
 * @access  Admin
 */
const migrateDrafts = async (req, res) => {
  try {
    console.log('Starting draft migration...');
    
    // Step 1: Get all interviews that have draft content
    const { data: interviews, error: fetchError } = await supabase
      .from('interviews')
      .select(`
        id,
        session_id,
        content,
        status,
        completed_date,
        created_at,
        updated_at
      `)
      .not('content', 'is', null)
      .neq('content', '{}');

    if (fetchError) {
      throw new Error(`Failed to fetch interviews: ${fetchError.message}`);
    }

    console.log(`Found ${interviews.length} interviews with content`);

    let migratedCount = 0;
    let skippedCount = 0;
    const errors = [];

    // Step 2: Process each interview with content
    for (const interview of interviews) {
      try {
        // Check if interview has ai_draft in content (this indicates it has draft data)
        if (!interview.content?.ai_draft) {
          console.log(`Skipping interview ${interview.id} - no ai_draft content`);
          skippedCount++;
          continue;
        }

        // Check if draft already exists for this specific interview content
        // Instead of checking per session, we should check if this specific interview's content was already migrated
        const { data: existingDrafts, error: checkError } = await supabase
          .from('drafts')
          .select('id, content')
          .eq('session_id', interview.session_id);

        if (checkError) {
          throw new Error(`Error checking existing drafts: ${checkError.message}`);
        }

        // Check if this specific interview's AI draft content already exists
        let isDuplicate = false;
        if (existingDrafts && existingDrafts.length > 0) {
          const currentAiDraft = interview.content.ai_draft;
          
          for (const existingDraft of existingDrafts) {
            // Compare the content to see if this specific AI draft was already migrated
            if (existingDraft.content && 
                JSON.stringify(existingDraft.content) === JSON.stringify(currentAiDraft.content)) {
              isDuplicate = true;
              break;
            }
          }
        }

        if (isDuplicate) {
          console.log(`Draft with identical content already exists for session ${interview.session_id}, skipping interview ${interview.id}`);
          skippedCount++;
          continue;
        }

        // Determine version number (increment from existing drafts for this session)
        const nextVersion = existingDrafts ? existingDrafts.length + 1 : 1;

        // Extract draft data from interview content
        const aiDraft = interview.content.ai_draft;
        
        // Determine stage based on interview status and completion
        let stage = 'first_draft';
        if (interview.status === 'completed' && interview.completed_date) {
          stage = 'pending_review';
        }

        // Calculate completion percentage (estimate based on content)
        let completionPercentage = 0;
        if (aiDraft.content) {
          const sections = aiDraft.content.sections || {};
          const totalSections = Object.keys(sections).length;
          const completedSections = Object.values(sections).filter(section => 
            section.content && section.content.trim().length > 50
          ).length;
          completionPercentage = totalSections > 0 ? (completedSections / totalSections) * 100 : 0;
        }

        // Create draft record
        const { data: newDraft, error: draftError } = await supabase
          .from('drafts')
          .insert({
            session_id: interview.session_id,
            content: aiDraft.content,
            stage: stage,
            version: nextVersion, // Use calculated version number
            completion_percentage: completionPercentage,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single();

        if (draftError) {
          throw new Error(`Failed to insert draft: ${draftError.message}`);
        }

        console.log(`✅ Migrated draft for session ${interview.session_id} (interview ${interview.id})`);
        migratedCount++;

        // Create draft history entry
        await supabase
          .from('draft_history')
          .insert({
            draft_id: newDraft.id,
            action: 'migrated',
            changes: {
              source: 'interview_migration',
              original_interview_id: interview.id,
              completion_percentage: completionPercentage,
              stage: stage
            },
            reason: 'Migrated from interviews table during system upgrade'
          });

      } catch (error) {
        console.error(`❌ Error migrating interview ${interview.id}:`, error.message);
        errors.push({
          interview_id: interview.id,
          session_id: interview.session_id,
          error: error.message
        });
      }
    }

    // Step 3: Return migration results
    const results = {
      total_interviews_processed: interviews.length,
      drafts_migrated: migratedCount,
      drafts_skipped: skippedCount,
      errors: errors.length,
      error_details: errors
    };

    console.log('Migration completed:', results);

    res.status(200).json({
      success: true,
      message: `Draft migration completed. Migrated ${migratedCount} drafts, skipped ${skippedCount}.`,
      data: results
    });

  } catch (error) {
    console.error('Draft migration failed:', error);
    res.status(500).json({
      success: false,
      message: 'Draft migration failed',
      error: error.message
    });
  }
};

/**
 * @desc    Get migration status and statistics
 * @route   GET /api/migration/draft-status
 * @access  Admin
 */
const getMigrationStatus = async (req, res) => {
  try {
    // Count interviews with draft content
    const { count: interviewsWithDrafts, error: interviewError } = await supabase
      .from('interviews')
      .select('id', { count: 'exact' })
      .not('content', 'is', null)
      .neq('content', '{}');

    if (interviewError) {
      throw new Error(`Failed to count interviews: ${interviewError.message}`);
    }

    // Count existing drafts
    const { count: existingDrafts, error: draftError } = await supabase
      .from('drafts')
      .select('id', { count: 'exact' });

    if (draftError) {
      throw new Error(`Failed to count drafts: ${draftError.message}`);
    }

    // Get sample of interviews with ai_draft content
    const { data: sampleInterviews, error: sampleError } = await supabase
      .from('interviews')
      .select('id, session_id, content, status')
      .not('content', 'is', null)
      .neq('content', '{}')
      .limit(5);

    if (sampleError) {
      throw new Error(`Failed to get sample interviews: ${sampleError.message}`);
    }

    const interviewsWithAiDrafts = sampleInterviews.filter(interview => 
      interview.content?.ai_draft
    ).length;

    res.status(200).json({
      success: true,
      data: {
        interviews_with_content: interviewsWithDrafts || 0,
        existing_drafts: existingDrafts || 0,
        sample_interviews_with_ai_drafts: interviewsWithAiDrafts,
        migration_needed: (interviewsWithDrafts || 0) > (existingDrafts || 0),
        sample_data: sampleInterviews.map(interview => ({
          id: interview.id,
          session_id: interview.session_id,
          has_ai_draft: !!interview.content?.ai_draft,
          status: interview.status
        }))
      }
    });

  } catch (error) {
    console.error('Error getting migration status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get migration status',
      error: error.message
    });
  }
};

module.exports = {
  migrateDrafts,
  getMigrationStatus
};
