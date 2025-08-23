/**
 * Webhook Controller for AI Processing Callbacks
 * Handles callbacks from n8n AI workflow for transcription and draft generation
 */

const supabaseService = require('../services/supabaseService');

// Helper function to update interview status and broadcast via WebSocket
const updateInterviewStatus = async (interviewId, status, additionalData = {}) => {
    const supabase = require('../config/database');

    try {
        // First get current content
        const { data: currentInterview } = await supabase
            .from('interviews')
            .select('content')
            .eq('id', interviewId)
            .single();

        const currentContent = currentInterview?.content || {};

        // Merge additional data into content field
        const updatedContent = { ...currentContent, ...additionalData };

        // Update only status, updated_at, and content
        const updateData = {
            status,
            updated_at: new Date().toISOString(),
            content: updatedContent
        };

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
                content: updatedContent
            };

            global.io.to(`interview-${interviewId}`).emit('interview-status-update', broadcastData);
            console.log(`📡 WebSocket broadcast sent for interview ${interviewId}: ${status}`);
        }

    } catch (error) {
        console.error('Failed to update interview status:', error);
        throw error;
    }
};

// Helper function to process draft data (moved from aiService)
const processDraftData = async (draft, interviewId, metadata) => {
    console.log('🎯 Processing AI draft data...');

    // The AI now returns a direct object structure, not wrapped in output
    let extractedData = {};
    let rawContent = '';

    // Check if draft is the direct AI response object
    if (draft && typeof draft === 'object' && (draft.summary_markdown || draft.title || draft.keywords)) {
        // Direct AI response format
        extractedData = draft;
        console.log('✅ Using direct AI response object');
    }
    // Legacy handling for wrapped responses
    else if (draft.output) {
        let outputContent = draft.output;

        if (typeof outputContent === 'string') {
            outputContent = outputContent.replace(/\\n/g, '\n').replace(/\\\\/g, '\\');
        }

        // Check for JSON in markdown code blocks
        if (typeof outputContent === 'string' && outputContent.includes('```json')) {
            try {
                const jsonMatch = outputContent.match(/```json\s*([\s\S]*?)\s*```/);
                if (jsonMatch && jsonMatch[1]) {
                    const jsonContent = jsonMatch[1].trim();
                    extractedData = JSON.parse(jsonContent);
                    console.log('✅ Successfully parsed JSON from markdown code block');
                }
            } catch (parseError) {
                console.log('⚠️ Error parsing JSON from markdown, using raw content');
                rawContent = outputContent;
            }
        }
        // Check for direct JSON response
        else if (typeof outputContent === 'string' && outputContent.trim().startsWith('{')) {
            try {
                extractedData = JSON.parse(outputContent);
                console.log('✅ Successfully parsed direct JSON response');
            } catch (parseError) {
                rawContent = outputContent;
            }
        }
        else {
            rawContent = outputContent;
        }
    } else {
        rawContent = draft.message?.content || draft.content || draft.text || '';
    }

    // Process extracted data
    let finalTitle = '';
    let finalStoryText = '';
    let finalKeywords = [];
    let finalFollowUps = [];
    let finalToVerify = { people: [], places: [], organizations: [], dates: [] };

    if (extractedData && Object.keys(extractedData).length > 0) {
        console.log('🎯 Extracting data from:', Object.keys(extractedData));
        
        // Extract title
        finalTitle = extractedData.title || extractedData.story_title || '';
        console.log('📝 Extracted title:', finalTitle);

        // Extract main story text - prioritize summary_markdown from new AI format
        if (extractedData.summary_markdown) {
            finalStoryText = extractedData.summary_markdown;
            console.log('📄 Using summary_markdown, length:', finalStoryText.length);
        } else {
            finalStoryText = extractedData.story_text || extractedData.content || extractedData.text || '';
            console.log('📄 Using fallback text, length:', finalStoryText.length);
        }

        // Extract keywords - handle both array and string formats
        if (Array.isArray(extractedData.keywords)) {
            finalKeywords = extractedData.keywords;
            console.log('🏷️ Extracted keywords:', finalKeywords.length, 'items');
        } else {
            finalKeywords = extractedData.key_themes || extractedData.themes || [];
            console.log('🏷️ Using fallback keywords:', finalKeywords.length, 'items');
        }

        // Extract follow-up questions
        if (Array.isArray(extractedData.follow_ups)) {
            finalFollowUps = extractedData.follow_ups;
            console.log('❓ Extracted follow-ups:', finalFollowUps.length, 'items');
        } else {
            finalFollowUps = extractedData.followup_questions || extractedData.questions || [];
            console.log('❓ Using fallback follow-ups:', finalFollowUps.length, 'items');
        }

        // Extract verification data - handle the new format with capitalized keys
        if (extractedData.to_verify) {
            const toVerifyData = extractedData.to_verify;
            finalToVerify.people = toVerifyData.People || toVerifyData.people || [];
            finalToVerify.places = toVerifyData.Places || toVerifyData.places || [];
            finalToVerify.organizations = toVerifyData.Organizations || toVerifyData.organizations || [];
            finalToVerify.dates = toVerifyData.Dates || toVerifyData.dates || [];
            console.log('✅ Extracted verification data:', {
                people: finalToVerify.people.length,
                places: finalToVerify.places.length,
                organizations: finalToVerify.organizations.length,
                dates: finalToVerify.dates.length
            });
        }
    } else if (rawContent) {
        finalStoryText = rawContent;
        const lines = rawContent.split('\n').filter(line => line.trim().length > 0);
        if (lines.length > 0) {
            finalTitle = lines[0].replace(/^#\s+/, '').trim();
        }
    }

    // Parse sections from story text if it contains markdown headers
    let extractedSections = {};
    console.log('🔍 Processing sections from finalStoryText:', finalStoryText?.substring(0, 200));
    
    if (finalStoryText && finalStoryText.includes('##')) {
        console.log('📝 Found markdown headers, parsing sections...');
        const sectionRegex = /##\s+([^\n]+)\s*\n([\s\S]*?)(?=\s*##\s+|\s*$)/g;
        const sectionMatches = [...finalStoryText.matchAll(sectionRegex)];
        console.log('📋 Found', sectionMatches.length, 'sections');

        sectionMatches.forEach((match, index) => {
            if (match[1] && match[2]) {
                const sectionKey = `section_${index + 1}`;
                extractedSections[sectionKey] = {
                    title: match[1].trim(),
                    content: match[2].trim()
                };
                console.log(`✅ Section ${index + 1}:`, match[1].trim(), '- Content length:', match[2].trim().length);
            }
        });
    } else {
        console.log('📄 No markdown headers found, creating single section');
        extractedSections.section_1 = {
            title: finalTitle || 'Main Content',
            content: finalStoryText || ''
        };
        console.log('📄 Single section created with content length:', (finalStoryText || '').length);
    }

    // Calculate word count
    const totalContent = Object.values(extractedSections).map(s => s.content).join(' ') + ' ' + finalStoryText;
    const calculatedWordCount = totalContent.split(/\s+/).filter(word => word.length > 0).length;
    const estimatedReadingTime = Math.max(1, Math.ceil(calculatedWordCount / 250));

    // Create normalized draft structure
    const normalizedDraft = {
        title: finalTitle || `Life Story Draft - ${new Date().toLocaleDateString()}`,
        content: {
            summary: finalStoryText.substring(0, 200) + (finalStoryText.length > 200 ? '...' : ''),
            fullMarkdown: finalStoryText,
            sections: extractedSections,
            keyThemes: finalKeywords,
            followUps: finalFollowUps,
            toVerify: finalToVerify,
            categories: [],
            metadata: {
                wordCount: calculatedWordCount,
                estimatedReadingTime: `${estimatedReadingTime} minutes`,
                generatedAt: new Date().toISOString(),
                sourceInterview: interviewId,
                processingMethod: 'AI_REAL_GENERATION_V2',
                aiModel: draft.model || 'n8n-endpoint',
                confidence: draft.confidence || null
            }
        },
        status: 'draft',
        version: '1.0',
        createdAt: new Date().toISOString()
    };

    console.log('✅ Draft data processing completed', normalizedDraft);
    return normalizedDraft;
};

// Helper function to create draft entry in drafts table
const createDraftEntry = async (interviewId, processedDraft) => {
    try {
        const supabase = require('../config/database');

        // Get interview details for draft creation
        const { data: interview } = await supabase
            .from('interviews')
            .select('session_id, content')
            .eq('id', interviewId)
            .single();

        if (!interview) {
            console.error('Interview not found for draft creation');
            return;
        }

        const existingDraftsResult = await supabaseService.getDraftsBySessionId(interview.session_id);
        let nextVersion = 1;

        if (existingDraftsResult.success && existingDraftsResult.data.length > 0) {
            const latestDraft = existingDraftsResult.data[0]; // Already sorted by version desc
            nextVersion = latestDraft.version + 1;
        }

        // Store all AI-generated data in the content JSONB field
        const draftData = {
            session_id: interview.session_id,
            version: nextVersion,
            stage: 'first_draft',
            content: {
                interview_id: interviewId,
                title: processedDraft.title,
                fullMarkdown: processedDraft.content.fullMarkdown,
                sections: processedDraft.content.sections,
                keyThemes: processedDraft.content.keyThemes,
                followUps: processedDraft.content.followUps,
                toVerify: processedDraft.content.toVerify,
                metadata: {
                    wordCount: processedDraft.content.metadata.wordCount,
                    estimatedReadingTime: processedDraft.content.metadata.estimatedReadingTime,
                    aiModel: processedDraft.content.metadata.aiModel,
                    confidence: processedDraft.content.metadata.confidence
                }
            },
            completion_percentage: 100.0, // Draft is complete when created
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        const { data, error } = await supabase
            .from('drafts')
            .insert(draftData)
            .select()
            .single();

        if (error) {
            console.error('Error creating draft entry:', error);
            throw error;
        }

        console.log(`✅ Draft entry created successfully: ${data.id}`);
        return data;

    } catch (error) {
        console.error('Error in createDraftEntry:', error);
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
        const notes = ['Draft generation failed: ' + error.message || 'Unknown error' + ' at ' + new Date().toISOString()];
        await updateInterviewStatus(interviewId, 'error', {
            status: 'error',
            notes
        });
    }
};

// @desc    Handle transcription completion webhook from n8n AI workflow
// @route   POST /api/webhooks/transcription-complete
// @access  Public (with validation)
const handleTranscriptionWebhook = async (req, res) => {
    // Always respond immediately to acknowledge webhook receipt
    res.json({
        success: true,
        message: 'Transcription webhook received',
        processed_at: new Date().toISOString()
    });

    try {
        const { transcription, metadata } = req.body;
        const interviewId = metadata?.id;

        // Validate required fields
        if (!interviewId) {
            console.error('Missing required field: interviewId in metadata');
            
            // Try to broadcast a general error if we can't identify the specific interview
            if (global.io && req.body?.metadata) {
                // If there's any other identifier we can use, try to broadcast
                const fallbackId = req.body.metadata.sessionId || req.body.metadata.requestId;
                if (fallbackId) {
                    const errorData = {
                        interviewId: fallbackId,
                        status: 'error',
                        error_message: 'Transcription failed due to missing interview ID. Please try again.',
                        error_type: 'missing_interview_id',
                        timestamp: new Date().toISOString()
                    };
                    
                    global.io.to(`interview-${fallbackId}`).emit('interview-status-update', errorData);
                    console.log(`📡 WebSocket error broadcast sent for fallback ID ${fallbackId}: missing_interview_id`);
                }
            }
            return;
        }

        console.log(`🎵 Webhook: Transcription ${transcription ? 'completed' : 'failed'} for interview ${interviewId}`);

        if (transcription) {
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
            console.error(`❌ Transcription failed for interview ${interviewId}`);
            const notes = ['Transcription failed at ' + new Date().toISOString()];
            await updateInterviewStatus(interviewId, 'error', { notes });
            
            // Also broadcast error via WebSocket for immediate frontend notification
            if (global.io) {
                const errorData = {
                    interviewId,
                    status: 'error',
                    error_message: 'Audio transcription failed. Please try uploading the file again.',
                    error_type: 'transcription_failed',
                    timestamp: new Date().toISOString()
                };
                
                global.io.to(`interview-${interviewId}`).emit('interview-status-update', errorData);
                console.log(`📡 WebSocket error broadcast sent for interview ${interviewId}: transcription_failed`);
            }
        }

    } catch (error) {
        console.error('Error processing transcription webhook:', error);

        // Try to update interview status to error if possible
        if (req.body?.metadata?.id) {
            try {
                const notes = [`Webhook processing failed: ${error.message} at ${new Date().toISOString()}`];
                await updateInterviewStatus(req.body.metadata.id, 'error', { notes });
                
                // Also broadcast error via WebSocket for immediate frontend notification
                const interviewId = req.body.metadata.id;
                if (global.io) {
                    const errorData = {
                        interviewId,
                        status: 'error',
                        error_message: 'Processing failed due to a technical error. Please try again.',
                        error_type: 'webhook_processing_error',
                        timestamp: new Date().toISOString()
                    };
                    
                    global.io.to(`interview-${interviewId}`).emit('interview-status-update', errorData);
                    console.log(`📡 WebSocket error broadcast sent for interview ${interviewId}: webhook_processing_error`);
                }
            } catch (statusError) {
                console.error('Failed to update interview status after webhook error:', statusError);
            }
        }
    }
};

// @desc    Handle draft generation completion webhook from n8n AI workflow
// @route   POST /api/webhooks/draft-complete
// @access  Public (with validation)
const handleDraftWebhook = async (req, res) => {
    // Always respond immediately to acknowledge webhook receipt
    res.json({
        success: true,
        message: 'Draft webhook received',
        processed_at: new Date().toISOString()
    });

    try {
        const { draft, metadata } = req.body;
        const interviewId = metadata?.id;

        // Validate required fields
        if (!interviewId) {
            console.error('Missing required field: interviewId in metadata');
            
            // Try to broadcast a general error if we can't identify the specific interview
            if (global.io && req.body?.metadata) {
                // If there's any other identifier we can use, try to broadcast
                const fallbackId = req.body.metadata.sessionId || req.body.metadata.requestId;
                if (fallbackId) {
                    const errorData = {
                        interviewId: fallbackId,
                        status: 'error',
                        error_message: 'Processing failed due to missing interview ID. Please try again.',
                        error_type: 'missing_interview_id',
                        timestamp: new Date().toISOString()
                    };
                    
                    global.io.to(`interview-${fallbackId}`).emit('interview-status-update', errorData);
                    console.log(`📡 WebSocket error broadcast sent for fallback ID ${fallbackId}: missing_interview_id`);
                }
            }
            return;
        }

        console.log(`📝 Webhook: Draft generation ${draft ? 'completed' : 'failed'} for interview ${interviewId}`);

        console.log('Draft data:', draft);
        console.log('Metadata:', metadata);
        
        if (draft) {
            // Draft generation successful
            console.log(`✅ Draft generation completed for interview ${interviewId}`);

            // Extract and process the AI draft data
            const processedDraft = await processDraftData(draft, interviewId, metadata);

            // Update interview status to completed with processed draft
            await updateInterviewStatus(interviewId, 'completed', {
                ai_draft: processedDraft,
                draft_completed_at: new Date().toISOString(),
                completed_date: new Date().toISOString(),
                draft_metadata: metadata || {}
            });

            // Create draft entry in drafts table
            await createDraftEntry(interviewId, processedDraft);

            console.log(`🎉 Interview ${interviewId} processing completed successfully via webhook`);

        } else {
            // Draft generation failed
            console.error(`❌ Draft generation failed for interview ${interviewId}`);
            const notes = ['Draft generation failed at ' + new Date().toISOString()];
            await updateInterviewStatus(interviewId, 'error', { notes });
            
            // Also broadcast error via WebSocket for immediate frontend notification
            if (global.io) {
                const errorData = {
                    interviewId,
                    status: 'error',
                    error_message: 'AI draft generation failed. Please try processing the interview again.',
                    error_type: 'draft_generation_failed',
                    timestamp: new Date().toISOString()
                };
                
                global.io.to(`interview-${interviewId}`).emit('interview-status-update', errorData);
                console.log(`📡 WebSocket error broadcast sent for interview ${interviewId}: draft_generation_failed`);
            }
        }

    } catch (error) {
        console.error('Error processing draft webhook:', error);

        // Try to update interview status to error if possible
        if (req.body?.metadata?.id) {
            try {
                const notes = [`Draft webhook processing failed: ${error.message} at ${new Date().toISOString()}`];
                await updateInterviewStatus(req.body.metadata.id, 'error', { notes });
                
                // Also broadcast error via WebSocket for immediate frontend notification
                const interviewId = req.body.metadata.id;
                if (global.io) {
                    const errorData = {
                        interviewId,
                        status: 'error',
                        error_message: 'Draft processing failed due to a technical error. Please try again.',
                    error_type: 'draft_webhook_processing_error',
                    timestamp: new Date().toISOString()
                };
                
                    global.io.to(`interview-${interviewId}`).emit('interview-status-update', errorData);
                    console.log(`📡 WebSocket error broadcast sent for interview ${interviewId}: draft_webhook_processing_error`);
                }
            } catch (statusError) {
                console.error('Failed to update interview status after draft webhook error:', statusError);
            }
        }
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
