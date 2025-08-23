/**
 * Webhook Controller for AI Processing Callbacks
 * Handles callbacks from n8n AI workflow for transcription and draft generation
 */

// Helper function to update interview status and broadcast via WebSocket
const updateInterviewStatus = async (interviewId, status, additionalData = {}) => {
  const supabase = require('../config/database');
  
  try {
    const updateData = {
      status,
      updated_at: new Date().toISOString(),
      ...additionalData
    };

    // Update content field with additional data if provided
    if (Object.keys(additionalData).length > 0) {
      // First get current content
      const { data: currentInterview } = await supabase
        .from('interviews')
        .select('content')
        .eq('id', interviewId)
        .single();

      const currentContent = currentInterview?.content || {};
      updateData.content = { ...currentContent, ...additionalData };
    }

    const { error } = await supabase
      .from('interviews')
      .update(updateData)
      .eq('id', interviewId);

    if (error) {
      console.error('Error updating interview status:', error);
      throw error;
    }

    console.log(`✅ Interview ${interviewId} status updated to: ${status}`);
    
    // Broadcast status update via WebSocket
    if (global.io) {
      const broadcastData = {
        interviewId,
        status,
        timestamp: new Date().toISOString(),
        ...additionalData
      };
      
      global.io.to(`interview-${interviewId}`).emit('interview-status-update', broadcastData);
      console.log(`📡 WebSocket broadcast sent for interview ${interviewId}: ${status}`);
    }
    
  } catch (error) {
    console.error('Failed to update interview status:', error);
    throw error;
  }
};

// Helper function to trigger draft generation
const triggerDraftGeneration = async (interviewId, transcriptionText, sessionData) => {
  try {
    const aiService = require('../services/aiService');
    
    const interviewMetadata = {
      id: interviewId,
      name: `Interview ${interviewId}`,
      type: 'life_story',
      client_name: sessionData.clientName,
      sessionId: sessionData.sessionId,
      notes: sessionData.notes || 'No notes provided',
      preferred_language: sessionData.preferred_language || 'auto-detect',
      webhookUrl: `${process.env.BACKEND_URL || 'http://localhost:3001'}/api/webhooks/draft-complete`
    };

    console.log(`📝 Starting async draft generation for interview ${interviewId}`);
    
    // Call n8n draft generation endpoint - this returns immediately after accepting the job
    const response = await aiService.generateDraft(transcriptionText, interviewMetadata);
    
    // The response indicates the job was accepted, not that draft is complete
    console.log(`✅ Draft generation job accepted for interview ${interviewId}`);
    // Don't handle completion here - wait for webhook callback
    
  } catch (error) {
    console.error('Error triggering draft generation:', error);
    await updateInterviewStatus(interviewId, 'error', { 
      error_message: `Draft generation failed: ${error.message}`,
      error_occurred_at: new Date().toISOString()
    });
  }
};

// @desc    Handle transcription completion webhook from n8n AI workflow
// @route   POST /api/webhooks/transcription-complete
// @access  Public (with validation)
const handleTranscriptionWebhook = async (req, res) => {
  try {
    const { transcription, success, error, metadata } = req.body;
    const interviewId = metadata.id;
    // Validate required fields
    if (!interviewId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required field: interviewId'
      });
    }

    console.log(`🎵 Webhook: Transcription ${success ? 'completed' : 'failed'} for interview ${interviewId}`);

    if (success && transcription) {
      // Transcription successful
      console.log(`✅ Transcription completed for interview ${interviewId} (${transcription.length} characters)`);
      
      // Update status to generating_draft
      await updateInterviewStatus(interviewId, 'generating_draft', { 
        transcription,
        transcription_completed_at: new Date().toISOString(),
        transcription_metadata: metadata || {}
      });

      // Get session data for draft generation
      const supabase = require('../config/database');
      const { data: interview } = await supabase
        .from('interviews')
        .select('session_id, content')
        .eq('id', interviewId)
        .single();

      if (interview) {
        // Extract session data from interview content
        const sessionData = {
          sessionId: interview.session_id,
          clientName: interview.content?.client_name || 'Unknown Client',
          notes: interview.content?.notes || 'No notes provided',
          preferred_language: interview.content?.preferred_language || 'auto-detect'
        };

        // Trigger draft generation
        await triggerDraftGeneration(interviewId, transcription, sessionData);
      }

    } else {
      // Transcription failed
      console.error(`❌ Transcription failed for interview ${interviewId}: ${error}`);
      await updateInterviewStatus(interviewId, 'error', { 
        error_message: `Transcription failed: ${error || 'Unknown error'}`,
        error_occurred_at: new Date().toISOString()
      });
    }

    // Always respond with success to acknowledge webhook receipt
    res.json({
      success: true,
      message: 'Transcription webhook processed',
      interviewId,
      processed_at: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error processing transcription webhook:', error);
    
    // Try to update interview status to error if possible
    if (req.body?.interviewId) {
      try {
        await updateInterviewStatus(req.body.interviewId, 'error', { 
          error_message: `Webhook processing failed: ${error.message}`,
          error_occurred_at: new Date().toISOString()
        });
      } catch (statusError) {
        console.error('Failed to update interview status after webhook error:', statusError);
      }
    }

    res.status(500).json({
      success: false,
      message: 'Failed to process transcription webhook',
      error: error.message
    });
  }
};

// @desc    Handle draft generation completion webhook from n8n AI workflow
// @route   POST /api/webhooks/draft-complete
// @access  Public (with validation)
const handleDraftWebhook = async (req, res) => {
  try {
    const { interviewId, draft, success, error, metadata } = req.body;

    // Validate required fields
    if (!interviewId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required field: interviewId'
      });
    }

    console.log(`📝 Webhook: Draft generation ${success ? 'completed' : 'failed'} for interview ${interviewId}`);

    if (success && draft) {
      // Draft generation successful
      console.log(`✅ Draft generation completed for interview ${interviewId}`);
      
      // Update status to completed with draft
      await updateInterviewStatus(interviewId, 'completed', { 
        ai_draft: draft,
        draft_completed_at: new Date().toISOString(),
        completed_date: new Date().toISOString(),
        draft_metadata: metadata || {}
      });

      console.log(`🎉 Interview ${interviewId} processing completed successfully via webhook`);

    } else {
      // Draft generation failed
      console.error(`❌ Draft generation failed for interview ${interviewId}: ${error}`);
      await updateInterviewStatus(interviewId, 'error', { 
        error_message: `Draft generation failed: ${error || 'Unknown error'}`,
        error_occurred_at: new Date().toISOString()
      });
    }

    // Always respond with success to acknowledge webhook receipt
    res.json({
      success: true,
      message: 'Draft webhook processed',
      interviewId,
      processed_at: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error processing draft webhook:', error);
    
    // Try to update interview status to error if possible
    if (req.body?.interviewId) {
      try {
        await updateInterviewStatus(req.body.interviewId, 'error', { 
          error_message: `Draft webhook processing failed: ${error.message}`,
          error_occurred_at: new Date().toISOString()
        });
      } catch (statusError) {
        console.error('Failed to update interview status after webhook error:', statusError);
      }
    }

    res.status(500).json({
      success: false,
      message: 'Failed to process draft webhook',
      error: error.message
    });
  }
};

// @desc    Health check for webhook endpoints
// @route   GET /api/webhooks/health
// @access  Public
const webhookHealthCheck = async (req, res) => {
  res.json({
    success: true,
    message: 'Webhook endpoints are healthy',
    timestamp: new Date().toISOString(),
    endpoints: {
      transcription: '/api/webhooks/transcription-complete',
      draft: '/api/webhooks/draft-complete'
    }
  });
};

module.exports = {
  handleTranscriptionWebhook,
  handleDraftWebhook,
  webhookHealthCheck
};
