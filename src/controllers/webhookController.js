/**
 * Webhook Controller for AI Processing Callbacks
 * Handles callbacks from n8n AI workflow for transcription and draft generation
 */

const { createFullLifeStory } = require('../services/fullLifeStoriesService');
const supabaseService = require('../services/supabaseService');
const supabaseSessionController = require('./supabaseSessionController');

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
    console.log('Processing draft data:', draft, metadata);

    let extractedData = null;
    let rawContent = '';

    // Handle string draft data with potential formatting issues
    if (typeof draft === 'string') {
        const draftStr = draft.trim();
        let jsonContent = null;

        // Case 1: Draft starts with ```json markdown code block
        if (draftStr.startsWith('```json')) {
            try {
                const jsonMatch = draftStr.match(/```json\s*([\s\S]*?)\s*```/);
                if (jsonMatch && jsonMatch[1]) {
                    jsonContent = jsonMatch[1].trim();
                    console.log('✅ Extracted JSON from markdown code block');
                }
            } catch (error) {
                console.log('⚠️ Failed to extract JSON from markdown code block:', error.message);
            }
        }
        // Case 2: Draft starts with ''json or other text prefix
        else if (draftStr.includes('json') && draftStr.includes('{')) {
            try {
                // Find the first { character and extract from there
                const jsonStartIndex = draftStr.indexOf('{');
                if (jsonStartIndex !== -1) {
                    jsonContent = draftStr.substring(jsonStartIndex);
                    console.log(`✅ Extracted JSON after prefix: "${draftStr.substring(0, jsonStartIndex)}"`);
                }
            } catch (error) {
                console.log('⚠️ Failed to extract JSON after text prefix:', error.message);
            }
        }
        // Case 3: Draft is a plain JSON string
        else if (draftStr.startsWith('{')) {
            jsonContent = draftStr;
            console.log('✅ Using plain JSON string');
        }

        // Try to parse the extracted JSON content
        if (jsonContent) {
            try {
                extractedData = JSON.parse(jsonContent);
                console.log('✅ Successfully parsed JSON content');
            } catch (parseError) {
                console.log('⚠️ Failed to parse extracted JSON content:', parseError.message);
                rawContent = draftStr; // Fall back to using raw content
            }
        } else {
            // No JSON found, use as raw content
            rawContent = draftStr;
            console.log('⚠️ No valid JSON structure found, using as raw text');
        }
    }
    // Check if draft is the direct AI response object
    else if (draft && typeof draft === 'object' && (draft.summary_markdown || draft.title || draft.keywords)) {
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
        // Handle JSON string response
        else if (typeof outputContent === 'string' && outputContent.trim().startsWith('{')) {
            try {
                extractedData = JSON.parse(outputContent);
                console.log('✅ Successfully parsed direct JSON response');
            } catch (parseError) {
                rawContent = outputContent;
            }
        }
        // Check for JSON in markdown code blocks
        else if (typeof outputContent === 'string' && outputContent.includes('```json')) {
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

        // Extract title
        finalTitle = extractedData.title || extractedData.story_title || '';

        // Extract main story text - prioritize summary_markdown from new AI format
        if (extractedData.summary_markdown) {
            finalStoryText = extractedData.summary_markdown;
        } else {
            finalStoryText = extractedData.story_text || extractedData.content || extractedData.text || '';
        }

        // Extract keywords - handle various formats including capitalized and hyphenated keys
        if (Array.isArray(extractedData.keywords)) {
            finalKeywords = extractedData.keywords;
        } else if (Array.isArray(extractedData.Keywords)) {
            finalKeywords = extractedData.Keywords;
        } else if (Array.isArray(extractedData['key-themes'])) {
            finalKeywords = extractedData['key-themes'];
        } else if (Array.isArray(extractedData.keyThemes)) {
            finalKeywords = extractedData.keyThemes;
        } else {
            finalKeywords = extractedData.key_themes || extractedData.themes || [];
        }

        // Extract follow-up questions - handle various formats including capitalized and hyphenated keys
        if (Array.isArray(extractedData.follow_ups)) {
            finalFollowUps = extractedData.follow_ups;
        } else if (Array.isArray(extractedData['Follow-ups'])) {
            finalFollowUps = extractedData['Follow-ups'];
        } else if (Array.isArray(extractedData.followups)) {
            finalFollowUps = extractedData.followups;
        } else {
            finalFollowUps = extractedData.followup_questions || extractedData.questions || [];
        }

        // Extract verification data - handle various formats including capitalized and hyphenated keys
        let toVerifyData = null;
        if (extractedData.to_verify) {
            toVerifyData = extractedData.to_verify;
        } else if (extractedData['To-Verify']) {
            toVerifyData = extractedData['To-Verify'];
        } else if (extractedData.toVerify) {
            toVerifyData = extractedData.toVerify;
        }

        if (toVerifyData) {
            finalToVerify.people = toVerifyData.People || toVerifyData.people || [];
            finalToVerify.places = toVerifyData.Places || toVerifyData.places || [];
            finalToVerify.organizations = toVerifyData.Organizations || toVerifyData.organizations || [];
            finalToVerify.dates = toVerifyData.Dates || toVerifyData.dates || [];
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

    if (finalStoryText && finalStoryText.includes('##')) {
        const sectionRegex = /##\s+([^\n]+)\s*\n([\s\S]*?)(?=\s*##\s+|\s*$)/g;
        const sectionMatches = [...finalStoryText.matchAll(sectionRegex)];

        sectionMatches.forEach((match, index) => {
            if (match[1] && match[2]) {
                const sectionKey = `section_${index + 1}`;
                extractedSections[sectionKey] = {
                    title: match[1].trim(),
                    content: match[2].trim()
                };
            }
        });
    } else {
        extractedSections.section_1 = {
            title: finalTitle || 'Main Content',
            content: finalStoryText || ''
        };
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
                confidence: draft.confidence || null,
                // Preserve regeneration metadata if present
                ...(metadata.regenerationType && {
                    regenerationType: metadata.regenerationType,
                    previousDraftId: metadata.previousDraftId,
                    adminInstructions: metadata.adminInstructions,
                    regeneratedAt: metadata.regeneratedAt,
                    isRegeneration: true
                })
            }
        },
        status: 'draft',
        version: '1.0',
        createdAt: new Date().toISOString()
    };

    console.log('✅ Draft data processing completed', {
        title: normalizedDraft.title,
        'content.keyThemes': normalizedDraft.content.keyThemes,
        'content.followUps': normalizedDraft.content.followUps,
        'content.toVerify': normalizedDraft.content.toVerify
    });
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

        // Check if this is a regeneration and handle regeneration-specific logic
        if (processedDraft.content?.metadata?.regenerationType === 'regenerate') {
            const previousDraftId = processedDraft.content.metadata.previousDraftId;

            // Get the current regeneration count from the existing draft
            const { data: existingDraft, error: fetchError } = await supabase
                .from('drafts')
                .select('content')
                .eq('id', previousDraftId)
                .single();

            if (fetchError) {
                console.error('Error fetching existing draft content:', fetchError);
            } else {
                const currentRegenerationCount = existingDraft.content?.metadata?.regenerationCount || 0;
                const newRegenerationCount = currentRegenerationCount + 1;

                // Preserve existing metadata and add regeneration-specific fields
                const existingMetadata = existingDraft.content?.metadata || {};

                // Merge existing metadata with new regeneration metadata
                draftData.content.metadata = {
                    ...existingMetadata, // Preserve all existing metadata
                    ...draftData.content.metadata, // Keep new AI-generated metadata
                    // Regeneration-specific fields
                    regenerationCount: newRegenerationCount,
                    regeneratedAt: new Date().toISOString(),
                    regeneratedFrom: previousDraftId,
                    regenerationType: 'admin_regenerate',
                    adminInstructions: processedDraft.content?.metadata?.adminInstructions || '',
                    adminNotes: existingMetadata.adminNotes || []
                };

                console.log(`🔄 Regeneration completed: Updating draft ${previousDraftId} regeneration count from ${currentRegenerationCount} to ${newRegenerationCount}`);
                console.log(`🔄 Updated metadata:`, JSON.stringify(draftData.content.metadata, null, 2));

                // Update the existing draft with new content and regeneration metadata
                const { error: updateError } = await supabase
                    .from('drafts')
                    .update({
                        content: draftData.content,
                        updated_at: new Date().toISOString(),
                        completion_percentage: 100.0
                    })
                    .eq('id', previousDraftId);

                if (updateError) {
                    console.error('Error updating existing draft for regeneration:', updateError);
                } else {
                    console.log(`✅ Existing draft ${previousDraftId} updated with regenerated content (regeneration count: ${newRegenerationCount})`);

                    // Delete the new draft entry since we updated the existing one
                    await supabase.from('drafts').delete().eq('id', data.id);

                    // Use the previous draft ID for WebSocket emission
                    data.id = previousDraftId;
                }
            }
        }

        // Emit WebSocket event for draft completion (including regeneration)
        if (global.io) {
            const isRegeneration = processedDraft.content?.metadata?.regenerationType === 'regenerate';
            const previousDraftId = processedDraft.content?.metadata?.previousDraftId;

            // For regeneration, use the original draft ID, not the new temporary one
            const finalDraftId = isRegeneration && previousDraftId ? previousDraftId : data.id;

            const broadcastData = {
                interviewId: interviewId,
                draftId: finalDraftId,
                sessionId: data.session_id,
                stage: 'completed',
                isRegeneration: isRegeneration,
                timestamp: new Date().toISOString()
            };

            global.io.emit('draft-generation-complete', broadcastData);
            console.log(`📡 WebSocket broadcast sent for draft completion: ${finalDraftId} (isRegeneration: ${isRegeneration}, originalId: ${data.id})`);
        }

        return data;

    } catch (error) {
        console.error('Error in createDraftEntry:', error);
        throw error;
    }
};

const _processStoryData = async (story, sessionId, metadata) => {
    try {
        let startTime = Date.now();
        console.log('Processing story data:', story);

        // Extract and parse AI content from response
        let aiContent = story;

        // Handle the new response structure: [{ data: "[{\"output\":\"...content...\"}]"}]
        if (Array.isArray(story) && story.length > 0 && story[0].data) {
            try {
                // Parse the JSON string in data field
                const parsedData = JSON.parse(story[0].data);

                // Extract all outputs from the parsed data array
                if (Array.isArray(parsedData) && parsedData.length > 0) {
                    // Check if we have multiple outputs to combine
                    if (parsedData.length > 1) {
                        // Combine all outputs from the array
                        const allOutputs = parsedData
                            .filter(item => item && item.output)
                            .map(item => item.output)
                            .join('\n\n');

                        console.log(`✅ Combined ${parsedData.length} chapters from AI response`);
                        aiContent = allOutputs;
                    } else if (parsedData[0].output) {
                        // Single output case
                        aiContent = parsedData[0].output;
                    }
                }
            } catch (parseError) {
                console.error('❌ Error parsing AI response data:', parseError.message);
                console.log('⚠️ Using raw result as fallback');
            }
        }
        // Handle legacy response formats
        else if (story.output) {
            aiContent = story.output;
        }
        // Handle nested response structure (similar to draft generator)
        else if (story.result) {
            if (story.result.message?.content) {
                aiContent = story.result.message.content;
            } else if (story.result.output) {
                aiContent = story.result.output;
            } else if (story.result.content) {
                aiContent = story.result.content;
            } else {
                aiContent = story.result;
            }
        }

        // If content is wrapped in markdown code blocks, extract it
        if (typeof aiContent === 'string' && aiContent.includes('```json')) {
            const jsonMatch = aiContent.match(/```json\s*([\s\S]*?)\s*```/);
            if (jsonMatch) {
                try {
                    aiContent = JSON.parse(jsonMatch[1]);
                } catch (parseError) {
                    console.warn('⚠️ Failed to parse JSON from markdown, using raw content');
                }
            }
        }

        const processingTime = Date.now() - startTime;
        // console.log(`✅ AI Service: Full life story generated in ${processingTime}ms`);

        // Normalize the response structure

        // Extract title from markdown if content is a string with markdown headers
        let extractedTitle = `Life Story for Session ${sessionId} - ${new Date().toLocaleDateString()}`;
        let extractedChapters = [];
        let extractedThemes = [];

        if (typeof aiContent === 'string') {
            // First check if story object has a title property
            if (story.title) {
                extractedTitle = story.title;
                console.log(`📝 Using title from story object: "${extractedTitle}"`);
            } else {
                // Try to extract from markdown headers
                let titleMatch = aiContent.match(/^\s*#\s+([^#].+?)\s*$/m);
                if (!titleMatch) {
                    titleMatch = aiContent.match(/^\s*##\s+(.+?)\s*$/m);
                }
                if (titleMatch && titleMatch[1]) {
                    extractedTitle = titleMatch[1];
                    console.log(`📝 Extracted title from markdown: "${extractedTitle}"`);
                } else {
                    console.log(`📝 Using default title: "${extractedTitle}"`);
                }
            }

            // Extract chapters from markdown (## Chapter)
            // Use a more robust regex that handles multiline content between chapters
            // This improved pattern ensures we capture all content between chapter headers
            // and handles various markdown formatting styles
            const chapterRegex = /##\s+([^\n]+)\s*\n([\s\S]*?)(?=\s*##\s+|\s*$)/g;
            const chapterMatches = [...aiContent.matchAll(chapterRegex)];
            if (chapterMatches) {
                for (const match of chapterMatches) {
                    if (match[1] && match[2]) {
                        extractedChapters.push({
                            title: match[1].trim(),
                            content: match[2].trim()
                        });
                    }
                }
            }

            // Extract potential themes from content
            // Look for common theme indicators in the text - both English and Hebrew
            extractedThemes = [];
            const themeIndicators = [
                // English themes
                'childhood', 'family', 'career', 'education', 'relationships', 'achievements',
                'challenges', 'travel', 'hobbies', 'community', 'immigration', 'military',
                'parenthood', 'wisdom', 'lessons', 'heritage', 'culture', 'religion', 'spirituality',
                // Hebrew themes
                'ילדות', 'משפחה', 'קריירה', 'חינוך', 'לימודים', 'יחסים', 'הישגים',
                'אתגרים', 'נסיעות', 'תחביבים', 'קהילה', 'עלייה', 'הגירה', 'צבא',
                'הורות', 'חוכמה', 'לקחים', 'מורשת', 'תרבות', 'דת', 'רוחניות',
                // Additional context-specific themes
                // 'הונגריה', 'ישראל', 'מדריך', 'נוער', 'טכנולוגיה', 'פיתוח', 'תיכון', 'ישיבה'
            ];

            themeIndicators.forEach(theme => {
                // Check for theme in content with appropriate word boundaries
                // For Hebrew text, we need a different approach as \b doesn't work well with Hebrew
                let themeRegex;

                // Check if theme contains Hebrew characters
                if (/[\u0590-\u05FF]/.test(theme)) {
                    // For Hebrew, use simple string matching with escaping special regex characters
                    const escapedTheme = theme.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    // Use a simpler approach that avoids character class issues
                    // Create a simpler regex pattern with properly escaped special characters
                    // Use a very simple pattern to avoid any regex issues
                    themeRegex = new RegExp('(^| )' + escapedTheme + '($| |\\.|,|:|;|\\?|!)', 'i');
                } else {
                    // For English, use standard word boundaries
                    themeRegex = new RegExp(`\\b${theme}\\b`, 'i');
                }

                if (themeRegex.test(aiContent)) {
                    extractedThemes.push(theme);
                }
            });

            // Also check chapter titles for themes
            extractedChapters.forEach(chapter => {
                themeIndicators.forEach(theme => {
                    // Use the same improved regex pattern for chapter titles
                    let themeRegex;

                    // Check if theme contains Hebrew characters
                    if (/[\u0590-\u05FF]/.test(theme)) {
                        // For Hebrew, use simple string matching with escaping special regex characters
                        const escapedTheme = theme.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                        // Use a simpler approach that avoids character class issues
                        // Create a simpler regex pattern with properly escaped special characters
                        // Use a very simple pattern to avoid any regex issues
                        themeRegex = new RegExp('(^| )' + escapedTheme + '($| |\\.|,|:|;|\\?|!)', 'i');
                    } else {
                        // For English, use standard word boundaries
                        themeRegex = new RegExp(`\\b${theme}\\b`, 'i');
                    }

                    if (themeRegex.test(chapter.title) && !extractedThemes.includes(theme)) {
                        extractedThemes.push(theme);
                    }
                });
            });
        }

        const normalizedStory = {
            title: aiContent.title || aiContent.storyTitle || extractedTitle || `Generated Life Story - ${new Date().toLocaleDateString()}`,
            content: aiContent.content || aiContent.story || aiContent,
            chapters: aiContent.chapters || extractedChapters || [],
            timeline: aiContent.timeline || [],
            keyMoments: aiContent.keyMoments || aiContent.highlights || [],
            themes: aiContent.themes || aiContent.keyThemes || extractedThemes || [],
            status: 'generated',
            version: 1,
            metadata: {
                processingTime,
                generatedAt: new Date().toISOString(),
                wordCount: typeof aiContent === 'string' ? aiContent.split(/\s+/).length : 0,
                aiModel: aiContent.metadata?.aiModel || 'n8n-workflow',
                sourceSessionId: sessionId,
                basedOnDrafts: metadata.approvedDrafts?.length || 0,
                totalInterviews: metadata.totalInterviews || 0,
                completedInterviews: metadata.completedInterviews || 0
            }
        };

        return normalizedStory;
    } catch (error) {
        console.error('Error in _processStoryData:', error);
        throw error;
    }
};

const _createFullLifeStoryEntry = async (sessionId, fullLifeStory, metadata) => {
    try {
        const sessionResult = await supabaseService.getSessionById(sessionId);
        if (!sessionResult.success) {
            console.error('Session not found:', sessionId);
            return res.status(404).json({
                success: false,
                message: 'Session not found'
            });
        }
        console.log('fullLifeStory', fullLifeStory);
        console.log('metadata', metadata);

        const session = sessionResult.data;
        const interviews = session.interviews || [];
        // Step 4: Save to dedicated full_life_stories table
        const fullLifeStoriesService = require('../services/fullLifeStoriesService');

        // Ensure title is never null by providing a fallback
        const storyTitle = fullLifeStory.title || `Life Story for Session ${sessionId} - ${new Date().toLocaleDateString()}`;
        console.log(`📝 Using title for full life story: "${storyTitle}"`); 
        
        const storyData = {
            sessionId,
            title: storyTitle, // Use validated title
            subtitle: fullLifeStory.subtitle,
            content: fullLifeStory.content,
            generatedBy: metadata.user?.email || 'admin',
            userId: metadata.user?.id || null,
            sourceMetadata: {
                approvedDrafts: metadata.approvedDrafts.length,
                totalInterviews: interviews.length,
                completedInterviews: interviews.filter(i => i.status === 'completed').length,
                generationDate: new Date().toISOString(),
                approvedDraftIds: metadata.approvedDrafts.map(d => d.id),
                sessionData: {
                    clientName: session.client_name,
                    clientAge: session.client_age,
                    sessionStatus: session.status
                }
            },
            generationStats: {
                processingTime: metadata?.processingTime || 0,
                aiModel: metadata?.aiModel || 'mock-ai-v1.0',
                sourceInterviews: metadata.approvedDrafts.length,
                totalWords: fullLifeStory.content?.totalWords || 0,
                estimatedPages: fullLifeStory.content?.estimatedPages || 0
            },
            totalWords: fullLifeStory.content?.totalWords || 0,
            processingTime: fullLifeStory.metadata?.processingTime || 0,
            aiModel: fullLifeStory.metadata?.aiModel || 'mock-ai-v1.0'
        };

        const saveResult = await fullLifeStoriesService.createFullLifeStory(storyData);

        if (!saveResult.success) {
            console.error('Failed to save full life story to database:', saveResult.error);
            return res.status(500).json({
                success: false,
                message: 'Failed to save generated full life story',
                error: saveResult.error
            });
        }

        // Step 5: Log the generation event
        // try {
        //     await req.logEvent({
        //         eventType: 'session',
        //         eventAction: 'full_story_generated',
        //         sessionId: sessionId,
        //         resourceId: saveResult.data.id,
        //         resourceType: 'full_life_story',
        //         eventData: {
        //             story_id: saveResult.data.id,
        //             version: saveResult.data.version,
        //             source_drafts: approvedDrafts.length,
        //             total_words: fullLifeStory.content?.totalWords || 0,
        //             processing_time: fullLifeStory.metadata?.processingTime || 0
        //         },
        //         severity: 'info'
        //     });
        // } catch (logError) {
        //     console.error('Failed to log full story generation:', logError);
        // }

        // Emit WebSocket event for draft completion (including regeneration)
        if (global.io) {

            const broadcastData = {
                sessionId: sessionId,
                stage: 'completed',
                timestamp: new Date().toISOString()
            };

            global.io.emit('full-life-story-generation-complete', broadcastData);
            console.log(`📡 WebSocket broadcast sent for full life story completion: ${sessionId}`);
        }

        return saveResult.data;

    } catch (error) {
        console.error('Error in _createFullLifeStoryEntry:', error);
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

        console.log('Processing draft webhook:', metadata);
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

const handleLifeStoryWebhook = async (req, res) => {
    res.json({
        success: true,
        message: 'Full life story webhook received',
        processed_at: new Date().toISOString()
    });

    try {
        const { story, metadata } = req.body;
        console.log('Processing full life story webhook:', metadata);
        
        const sessionId = JSON.parse(metadata).sessionId;

        // Validate required fields
        if (!sessionId) {
            console.error('Missing required field: sessionId in metadata');

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

        console.log(`📝 Webhook: Full life story generation ${story ? 'completed' : 'failed'} for session ${sessionId}`);

        if (story) {
            // Story generation successful
            console.log(`✅ Story generation completed for session ${sessionId}`);

            // Extract and process the AI draft data
            const processedStory = await _processStoryData(JSON.parse(story), sessionId, metadata);

            // Create draft entry in drafts table
            await _createFullLifeStoryEntry(sessionId, processedStory, metadata);

            console.log(`🎉 Full life story processing completed successfully via webhook`);

        } else {
            // Story generation failed
            console.error(`❌ Story generation failed for session ${sessionId}`);
            const notes = ['Story generation failed at ' + new Date().toISOString()];

            // Also broadcast error via WebSocket for immediate frontend notification
            if (global.io) {
                const errorData = {
                    sessionId,
                    status: 'error',
                    error_message: 'AI story generation failed. Please try processing the interview again.',
                    error_type: 'story_generation_failed',
                    timestamp: new Date().toISOString()
                };

                global.io.to(`session-${sessionId}`).emit('session-status-update', errorData);
                console.log(`📡 WebSocket error broadcast sent for session ${sessionId}: story_generation_failed`);
            }
        }

    } catch (error) {
        console.error('Error processing Full Life Story webhook:', error);

        if (req.body?.metadata?.id) {
            try {
                // Also broadcast error via WebSocket for immediate frontend notification
                const sessionId = req.body.metadata.id;
                if (global.io) {
                    const errorData = {
                        sessionId,
                        status: 'error',
                        error_message: 'Full Life Story processing failed due to a technical error. Please try again.',
                        error_type: 'full_life_story_webhook_processing_error',
                        timestamp: new Date().toISOString()
                    };

                    global.io.to(`session-${sessionId}`).emit('session-status-update', errorData);
                    console.log(`📡 WebSocket error broadcast sent for session ${sessionId}: full_life_story_webhook_processing_error`);
                }
            } catch (statusError) {
                console.error('Failed to update session status after full life story webhook error:', statusError);
            }
        }
    }
}

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
    handleLifeStoryWebhook,
    webhookHealthCheck
};
