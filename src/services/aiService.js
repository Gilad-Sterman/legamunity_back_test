/**
 * AI Service for transcription and summarization
 * Supports both mock mode and real n8n endpoint integration
 */

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const config = require('../config/config');

/**
 * Utility function to sleep for a given duration
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Retry wrapper for API calls
 * @param {Function} fn - Function to retry
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} delay - Delay between retries in ms
 * @returns {Promise<any>} - Result of the function
 */
const withRetry = async (fn, maxRetries = config.ai.maxRetries, delay = config.ai.retryDelay) => {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      console.warn(`🔄 AI Service attempt ${attempt}/${maxRetries} failed:`, error.message);

      if (attempt < maxRetries) {
        await sleep(delay * attempt); // Exponential backoff
      }
    }
  }

  throw new Error(`AI Service failed after ${maxRetries} attempts. Last error: ${lastError.message}`);
};

/**
 * Call the real n8n AI endpoint
 * @param {Object} payload - Data to send to the AI endpoint
 * @param {string} operation - Type of operation (transcribe, process, generate)
 * @returns {Promise<Object>} - AI service response
 */
const callAIEndpoint = async (payload, operation) => {
  if (!config.ai.endpointUrl) {
    throw new Error('AI_ENDPOINT_URL not configured');
  }

  const headers = {
    'Content-Type': 'application/json',
  };

  // Add API key if configured
  if (config.ai.apiKey) {
    headers['Authorization'] = `Bearer ${config.ai.apiKey}`;
    // Alternative header formats that n8n might use:
    // headers['X-API-Key'] = config.ai.apiKey;
    // headers['n8n-api-key'] = config.ai.apiKey;
  }

  const requestData = {
    operation,
    ...payload,
    timestamp: new Date().toISOString(),
  };

  console.log(`🤖 Calling AI endpoint for ${operation}:`, config.ai.endpointUrl);

  const response = await axios.post(config.ai.endpointUrl, requestData, {
    headers,
    timeout: config.ai.requestTimeout,
  });

  if (response.status !== 200) {
    throw new Error(`AI endpoint returned status ${response.status}: ${response.statusText}`);
  }

  return response.data;
};

/**
 * Upload file to AI endpoint for processing
 * @param {string} filePath - Path to the file
 * @param {string} operation - Type of operation
 * @param {Object} metadata - Additional metadata
 * @returns {Promise<Object>} - AI service response
 */
const uploadFileToAI = async (fileUrl, operation, metadata = {}) => {
  if (config.ai.mockMode) {
    return mockTranscribeAudio(filePath);
  }

  const startTime = Date.now();
  console.log(`🚀 Calling real AI audio transcription endpoint... fileUrl: ${fileUrl}`);

  // Use the specific AI_UPLOAD_RECORDINGS_ENDPOINT_URL for transcription
  const audioTranscriptionEndpointUrl = process.env.AI_UPLOAD_RECORDINGS_ENDPOINT_URL;

  if (!audioTranscriptionEndpointUrl) {
    throw new Error('AI_UPLOAD_RECORDINGS_ENDPOINT_URL is not configured');
  }

  // Increase timeout for large audio files (10 minutes default instead of 4 minutes)
  const timeoutMs = parseInt(process.env.AI_REQUEST_TIMEOUT) || 600000;

  const payload = {
    fileUrl,
    operation,
    metadata,
  };

  try {
    const response = await axios.post(audioTranscriptionEndpointUrl, payload, {
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.AI_API_KEY && { 'Authorization': `Bearer ${process.env.AI_API_KEY}` })
      },
      timeout: timeoutMs
    });

    const elapsedTime = Date.now() - startTime;
    console.log(`✅ n8n AI audio transcription responded in ${elapsedTime}ms`);

    if (response.status !== 200) {
      throw new Error(`AI endpoint returned status ${response.status}: ${response.statusText}`);
    }

    return response.data;
  } catch (error) {
    const elapsedTime = Date.now() - startTime;
    console.error(`❌ Audio transcription failed after ${elapsedTime}ms: ${error.message}`);
    if (error.code === 'ECONNABORTED') {
      console.error('🕐 Transcription request timed out - Audio processing took longer than expected');
    } else if (error.response) {
      // Log only essential response error information
      console.error(`Response error: Status ${error.response.status} - ${error.response.statusText}`);
    }
    // Create a cleaner error object with just the essential information
    const cleanError = new Error(`Audio transcription failed: ${error.message}`);
    cleanError.code = error.code;
    cleanError.status = error.response?.status;
    throw cleanError;
  }
};

/**
 * Mock transcription service (fallback when endpoint is not available)
 * @param {string} audioFilePath - Path to the audio file
 * @returns {Promise<string>} - Mock transcribed text
 */
const mockTranscribeAudio = async (audioFilePath) => {
  console.log('🎤 [MOCK] Transcribing audio file:', audioFilePath);

  // Simulate processing time
  await sleep(2000);

  // Mock transcription result
  const mockTranscription = `
This is a mock transcription of the audio file. In a real implementation, this would be the actual transcribed text from the audio file.

The interview covered topics including:
- Early childhood memories
- Family history and traditions
- Career journey and achievements
- Life lessons and wisdom
- Personal relationships and friendships

This transcription would be much longer and contain the actual spoken content from the interview.
  `.trim();

  console.log('✅ [MOCK] Transcription completed');
  return mockTranscription;
};

/**
 * Transcription service - supports both mock and real endpoint
 * @param {string} audioFilePath - Path to the audio file
 * @returns {Promise<string>} - Transcribed text
 */
const transcribeAudio = async (fileUrl, metadata) => {
  // if (config.ai.mockMode) {
  //   return mockTranscribeAudio(audioFilePath);
  // }

  const result = await uploadFileToAI(fileUrl, 'transcribe', metadata);

  console.log('✅ n8n AI transcription responded');
  console.log(result);
  return result.transcription || result.text || result.content;
};

/**
 * Mock text processing service (fallback when endpoint is not available)
 * @param {string} textContent - Raw text content
 * @returns {Promise<string>} - Mock processed text
 */
const mockProcessText = async (textContent) => {
  console.log('📝 [MOCK] Processing text content');

  // Simulate processing time
  await sleep(1000);

  console.log('✅ [MOCK] Text processing completed');
  return textContent;
};

/**
 * Text processing service - supports both mock and real endpoint
 * @param {string} textContent - Raw text content
 * @returns {Promise<string>} - Processed text
 */
const processText = async (textContent) => {
  if (config.ai.mockMode) {
    return mockProcessText(textContent);
  }

  return withRetry(async () => {
    const result = await callAIEndpoint({
      content: textContent,
      contentType: 'text',
    }, 'process');

    console.log('✅ Real AI text processing completed');
    return result.processedContent || result.content || textContent;
  });
};

/**
 * Mock AI summarization service (fallback when endpoint is not available)
 * @param {string} content - Text content to summarize
 * @param {Object} interviewMetadata - Interview metadata for context
 * @returns {Promise<Object>} - Mock generated draft content
 */
const mockGenerateDraft = async (content, interviewMetadata) => {
  console.log('🤖 [MOCK] Generating AI draft for interview:', interviewMetadata.id);

  // Simulate AI processing time
  await sleep(3000);

  // Mock draft generation
  const mockDraft = {
    title: `Life Story Draft - ${interviewMetadata.name || 'Interview'} ${new Date().toLocaleDateString()}`,
    content: {
      summary: `This interview session captured valuable insights about the subject's life journey. The conversation covered personal experiences, family history, and important life events.`,

      sections: {
        introduction: `Based on the interview conducted, this section introduces the subject and provides context for their life story.`,

        earlyLife: `The early life section covers childhood memories, family background, and formative experiences that shaped the subject's character.`,

        careerJourney: `This section details the professional journey, career milestones, and significant achievements throughout their working life.`,

        personalRelationships: `Personal relationships and family connections are explored, highlighting important people who influenced their life.`,

        lifeWisdom: `The wisdom and life lessons learned over the years are captured, providing valuable insights for future generations.`,

        conclusion: `The conclusion ties together the various aspects of the life story, creating a cohesive narrative of the subject's journey.`
      },

      keyThemes: [
        'Family and Heritage',
        'Personal Growth',
        'Career Development',
        'Life Challenges',
        'Wisdom and Reflection'
      ],

      metadata: {
        wordCount: 2500,
        estimatedReadingTime: '10 minutes',
        generatedAt: new Date().toISOString(),
        sourceInterview: interviewMetadata.id,
        processingMethod: 'AI_MOCK_GENERATION'
      }
    },

    status: 'draft',
    version: '1.0',
    createdAt: new Date().toISOString()
  };

  console.log('✅ [MOCK] AI draft generation completed');
  return mockDraft;
};

/**
 * AI draft generation service - supports both mock and real endpoint
 * @param {string} content - Text content to summarize
 * @param {Object} interviewMetadata - Interview metadata for context
 * @returns {Promise<Object>} - Generated draft content
 */
// new version
const generateDraft = async (content, interviewMetadata) => {
  // if (config.ai.mockMode) {
  //   return mockGenerateDraft(content, interviewMetadata);
  // }

  const startTime = Date.now();
  console.log('🚀 Calling real AI draft generator endpoint...');

  // Use the specific AI_DRAFT_GENERETOR_ENDPOINT_URL for draft generation
  const draftEndpointUrl = process.env.AI_DRAFT_GENERETOR_ENDPOINT_URL;

  if (!draftEndpointUrl) {
    throw new Error('AI_DRAFT_GENERETOR_ENDPOINT_URL is not configured');
  }

  const payload = {
    text: content,
    interviewMetadata: {
      id: interviewMetadata.id,
      type: interviewMetadata.type || 'life_story',
      clientName: interviewMetadata.client_name,
      sessionId: interviewMetadata.sessionId,
      duration: interviewMetadata.duration,
      location: interviewMetadata.location,
      notes: interviewMetadata.notes,
      webhookUrl: interviewMetadata.webhookUrl,
      // Include regeneration metadata if present
      ...(interviewMetadata.regenerationType && {
        regenerationType: interviewMetadata.regenerationType,
        previousDraftId: interviewMetadata.previousDraftId,
        adminInstructions: interviewMetadata.adminInstructions,
        regeneratedAt: interviewMetadata.regeneratedAt
      })
    },
    preferences: {
      language: interviewMetadata.preferred_language,
    }
  };

  try {
    const response = await axios.post(draftEndpointUrl, payload, {
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.AI_API_KEY && { 'Authorization': `Bearer ${process.env.AI_API_KEY}` })
      },
      timeout: parseInt(process.env.AI_REQUEST_TIMEOUT) || 30000 // 30 seconds for immediate response
    });

    const elapsedTime = Date.now() - startTime;
    console.log(`✅ n8n AI draft generation responded in ${elapsedTime}ms`);
    
    console.log('✅ n8n AI draft generation responded');
    console.log(response.data);
    
    // Check if response contains full draft (output field) or just acknowledgment
    if (response.data.output) {
      console.log('🎯 Received full draft response, triggering webhook directly');
      
      // Trigger webhook directly with the draft data
      const webhookPayload = {
        draft: response.data,
        metadata: { id: interviewMetadata.id }
      };
      
      // Call our own webhook endpoint
      const webhookUrl = `https://legamunity-test.onrender.com/api/webhooks/draft-complete`;
      
      try {
        await axios.post(webhookUrl, webhookPayload, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000
        });
        console.log('✅ Successfully triggered draft webhook with full response');
      } catch (webhookError) {
        console.error('❌ Error triggering draft webhook:', webhookError.message);
      }
    }
    
    return response.data; // Return immediate response from n8n
  } catch (error) {
      const elapsedTime = Date.now() - startTime;
      console.error(`❌ AI request failed after ${elapsedTime}ms: ${error.message}`);
      if (error.code === 'ECONNABORTED') {
        console.error('🕐 Request timed out - AI processing took longer than expected');
      } else if (error.response) {
        // Log only essential response error information
        console.error(`Response error: Status ${error.response.status} - ${error.response.statusText}`);
      }
      // Create a cleaner error object with just the essential information
      const cleanError = new Error(`AI draft generation failed: ${error.message}`);
      cleanError.code = error.code;
      cleanError.status = error.response?.status;
      throw cleanError;
  }
};

    // Calculate word count from the actual content
    // const totalContent = Object.values(extractedSections).join(' ') + ' ' + extractedSummary;
    // const calculatedWordCount = totalContent.split(/\s+/).filter(word => word.length > 0).length;
    // const estimatedReadingTime = Math.max(1, Math.ceil(calculatedWordCount / 250)); // 250 words per minute

    // Extract title from AI content or use default
    // let finalTitle = '';
    // if (normalizedContent && normalizedContent.includes('**Title**:')) {
    //   const titleMatch = normalizedContent.match(/\*\*Title\*\*:\s*([^\n]+)/i);
    //   if (titleMatch) {
    //     finalTitle = titleMatch[1].trim();
    //   }
    // }

    // if (!finalTitle) {
    //   finalTitle = parsedContent?.title || result.title || `Life Story Draft - ${interviewMetadata.name || interviewMetadata.clientName || 'Interview'} ${new Date().toLocaleDateString()}`;
    // }

    // Normalize the response format to match expected structure
    // const normalizedDraft = {
    //   title: finalTitle,
    //   content: {
    //     summary: extractedSummary || aiGeneratedContent.substring(0, 200) + '...' || 'AI-generated summary from real endpoint',
    //     sections: Object.keys(extractedSections).length > 0 ?
    //       // Filter out sections with minimal/empty content
    //       Object.fromEntries(
    //         Object.entries(extractedSections).filter(([key, content]) => {
    //           const cleanContent = content.trim();
    //           // Remove sections that are just "|", empty, or contain only special characters/whitespace
    //           return cleanContent.length > 2 &&
    //             cleanContent !== '|' &&
    //             cleanContent !== '||' &&
    //             cleanContent !== '|||' &&
    //             !(/^[\s\|\-\*\#]*$/.test(cleanContent)) && // Only whitespace, pipes, dashes, asterisks, hashes
    //             !key.toLowerCase().includes('to-verify') && // Remove To-Verify sections
    //             !key.toLowerCase().includes('toverify');
    //         })
    //       ) : {
    //         introduction: 'AI-generated introduction',
    //         mainStory: aiGeneratedContent || 'AI-generated main story',
    //         conclusion: 'AI-generated conclusion'
    //       },
    //     keyThemes: extractedKeywords.length > 0 ? extractedKeywords : [],
    //     followUps: extractedFollowUps.length > 0 ? extractedFollowUps : [],
    //     toVerify: Object.keys(extractedToVerify).length > 0 ? extractedToVerify : {},
    //     categories: extractedCategories.length > 0 ? extractedCategories : [],
    //     metadata: {
    //       wordCount: calculatedWordCount,
    //       estimatedReadingTime: `${estimatedReadingTime} minutes`,
    //       generatedAt: new Date().toISOString(),
    //       sourceInterview: interviewMetadata.id,
    //       processingMethod: 'AI_REAL_GENERATION',
    //       aiModel: result.model || result.aiModel || 'n8n-endpoint',
    //       confidence: result.confidence || null,
    //       endpointUrl: draftEndpointUrl
    //     }
    //   },
    //   status: result.status || 'draft',
    //   version: result.version || '1.0',
    //   createdAt: new Date().toISOString()
    // };

    // return normalizedDraft;
//   });
// };

/**
 * Main processing function that handles the complete workflow
 * Simplified flow: Audio → Transcription → Draft Generation OR Text → Draft Generation
 * @param {string} filePath - Path to uploaded file
 * @param {Object} interviewData - Interview metadata
 * @returns {Promise<Object>} - Processing results
 */
const processInterviewFile = async (filePath, interviewData) => {
  console.log('🚀 Starting simplified interview file processing workflow');
  const startTime = Date.now();

  try {
    let textContent = '';
    const fileExtension = filePath.split('.').pop().toLowerCase();

    // Determine processing method based on file type
    if (['mp3', 'wav', 'm4a', 'aac', 'ogg', 'webm', 'flac'].includes(fileExtension)) {
      console.log('🎵 Audio file detected, starting transcription...');
      textContent = await transcribeAudio(filePath);
      console.log('✅ Transcription completed, proceeding directly to draft generation');
    } else if (['txt', 'md', 'pdf', 'doc', 'docx'].includes(fileExtension)) {
      console.log('📄 Text file detected, reading content directly...');
      // Read file content directly without processText stage
      if (config.ai.mockMode) {
        textContent = 'Mock text content from uploaded file for testing purposes';
      } else {
        textContent = fs.readFileSync(filePath, 'utf8');
      }
      console.log('✅ Text content loaded, proceeding directly to draft generation');
    } else {
      throw new Error(`Unsupported file type: ${fileExtension}`);
    }

    // Validate text content
    if (!textContent || textContent.trim().length === 0) {
      throw new Error('No text content available for draft generation');
    }

    // Generate AI draft directly from text content    
    const draft = await generateDraft(textContent, interviewData);

    const processingTime = Date.now() - startTime;

    return {
      success: true,
      transcription: textContent,
      draft: draft,
      processingTime: `${processingTime}ms`,
      message: 'Interview file processed successfully with simplified workflow',
      metadata: {
        fileType: fileExtension,
        processingMode: config.ai.mockMode ? 'mock' : 'real',
        workflowType: 'simplified_direct_to_draft',
        textContentLength: textContent.length,
        endpointUsed: config.ai.mockMode ? null : process.env.AI_DRAFT_GENERETOR_ENDPOINT_URL
      }
    };

  } catch (error) {
    console.error('❌ Error processing interview file:', error);
    throw error;
  }
};

/**
 * Health check function to test AI service connectivity
 * @returns {Promise<Object>} - Health status
 */
const healthCheck = async () => {
  const status = {
    service: 'AI Service',
    status: 'unknown',
    mode: config.ai.mockMode ? 'mock' : 'real',
    endpoint: config.ai.endpointUrl,
    timestamp: new Date().toISOString()
  };

  if (config.ai.mockMode) {
    status.status = 'healthy';
    status.message = 'Running in mock mode';
    return status;
  }

  try {
    // Test endpoint connectivity
    const testResult = await callAIEndpoint({
      test: true,
      message: 'Health check ping'
    }, 'health');

    status.status = 'healthy';
    status.message = 'Real endpoint is accessible';
    status.responseTime = testResult.responseTime || 'unknown';
  } catch (error) {
    status.status = 'unhealthy';
    status.message = error.message;
    status.error = error.name;
  }

  return status;
};

/**
 * Get current AI service configuration
 * @returns {Object} - Configuration details
 */
const getConfig = () => {
  return {
    mockMode: config.ai.mockMode,
    endpointConfigured: !!config.ai.endpointUrl,
    endpointUrl: config.ai.endpointUrl ? config.ai.endpointUrl.replace(/\/+$/, '') : null, // Remove trailing slashes
    hasApiKey: !!config.ai.apiKey,
    requestTimeout: config.ai.requestTimeout,
    maxRetries: config.ai.maxRetries,
    retryDelay: config.ai.retryDelay
  };
};

/**
 * Update AI service configuration at runtime (for testing purposes)
 * @param {Object} newConfig - New configuration values
 * @returns {Object} - Updated configuration
 */
const updateConfig = (newConfig) => {
  if (newConfig.endpointUrl !== undefined) {
    config.ai.endpointUrl = newConfig.endpointUrl;
  }
  if (newConfig.apiKey !== undefined) {
    config.ai.apiKey = newConfig.apiKey;
  }
  if (newConfig.mockMode !== undefined) {
    config.ai.mockMode = newConfig.mockMode;
  }
  if (newConfig.requestTimeout !== undefined) {
    config.ai.requestTimeout = newConfig.requestTimeout;
  }

  console.log('🔧 AI Service configuration updated:', getConfig());
  return getConfig();
};

/**
 * Generate a comprehensive full life story from all approved drafts and session data
 * @param {Object} fullStoryData - Complete session data with approved drafts
 * @returns {Promise<Object>} - Generated full life story
 */
const generateFullLifeStory = async (fullStoryData) => {
  console.log('🤖 AI Service: Generating full life story...');
  const startTime = Date.now();

  if (config.ai.mockMode) {
    return mockGenerateFullLifeStory(fullStoryData);
  }

  return withRetry(async () => {
    // Determine which endpoint URL to use
    const fullStoryEndpointUrl = process.env.AI_FULL_LIFE_STORY_GENERETOR_ENDPOINT_URL;

    if (!fullStoryEndpointUrl) {
      throw new Error('AI_FULL_LIFE_STORY_GENERETOR_ENDPOINT_URL not configured');
    }

    // console.log('🤖 Using full life story endpoint:', fullStoryEndpointUrl);

    // Prepare payload for the real full life story generator endpoint
    const payload = {
      operation: 'generate_full_story',
      sessionId: fullStoryData.sessionId,
      clientInfo: fullStoryData.clientInfo,
      approvedDrafts: fullStoryData.approvedDrafts,
      sessionNotes: fullStoryData.sessionNotes,
      totalInterviews: fullStoryData.totalInterviews,
      completedInterviews: fullStoryData.completedInterviews,
      notes: fullStoryData.notes,
      generatedAt: new Date().toISOString()
    };

    console.log('PAYLOAD:', payload);

    const headers = {
      'Content-Type': 'application/json',
    };

    // Add API key if configured
    if (config.ai.apiKey) {
      headers['Authorization'] = `Bearer ${config.ai.apiKey}`;
    }

    // console.log('🚀 Calling real full life story generator endpoint...');
    // console.log('📤 PAYLOAD:', JSON.stringify(payload, null, 2));

    // Call the real full life story generator endpoint
    const response = await axios.post(fullStoryEndpointUrl, payload, {
      headers,
      timeout: config.ai.requestTimeout,
    });

    const result = response.data;
    // console.log('✅ Real AI full life story generation completed successfully');
    console.log('🔍 RAW AI ENDPOINT RESPONSE:', JSON.stringify(result, null, 2));

    // Extract and parse AI content from response
    let aiContent = result;

    // Handle the new response structure: [{ data: "[{\"output\":\"...content...\"}"]" }]
    if (Array.isArray(result) && result.length > 0 && result[0].data) {
      try {
        // Parse the JSON string in data field
        const parsedData = JSON.parse(result[0].data);
        
        // Extract the output field from the parsed data
        if (Array.isArray(parsedData) && parsedData.length > 0 && parsedData[0].output) {
          aiContent = parsedData[0].output;
        }
      } catch (parseError) {
        console.error('❌ Error parsing AI response data:', parseError.message);
        console.log('⚠️ Using raw result as fallback');
      }
    }
    // Handle legacy response formats
    else if (result.output) {
      aiContent = result.output;
    }
    // Handle nested response structure (similar to draft generator)
    else if (result.result) {
      if (result.result.message?.content) {
        aiContent = result.result.message.content;
      } else if (result.result.output) {
        aiContent = result.result.output;
      } else if (result.result.content) {
        aiContent = result.result.content;
      } else {
        aiContent = result.result;
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
    let extractedTitle = 'Generated Life Story';
    let extractedChapters = [];
    let extractedThemes = [];

    if (typeof aiContent === 'string') {
      // Extract title from first markdown header (# Title or ## Title)
      // First try to find a level 1 header
      let titleMatch = aiContent.match(/^\s*#\s+([^#].+?)\s*$/m);
      
      // If no level 1 header found, try to find the first level 2 header
      if (!titleMatch) {
        titleMatch = aiContent.match(/^\s*##\s+(.+?)\s*$/m);
      }
      
      if (titleMatch && titleMatch[1]) {
        extractedTitle = titleMatch[1].trim();
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
        'הונגריה', 'ישראל', 'מדריך', 'נוער', 'טכנולוגיה', 'פיתוח', 'תיכון', 'ישיבה'
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
      title: aiContent.title || aiContent.storyTitle || extractedTitle,
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
        sourceSessionId: fullStoryData.sessionId,
        basedOnDrafts: fullStoryData.approvedDrafts?.length || 0,
        totalInterviews: fullStoryData.totalInterviews || 0,
        completedInterviews: fullStoryData.completedInterviews || 0
      }
    };

    return normalizedStory;
  });
};

/**
 * Mock implementation for full life story generation
 * @param {Object} fullStoryData - Complete session data with approved drafts
 * @returns {Object} - Mock generated full life story
 */
// const mockGenerateFullLifeStory = (fullStoryData) => {
//   console.log('🎭 Mock AI: Generating full life story for session:', fullStoryData.sessionId);

//   const { clientInfo, approvedDrafts, sessionNotes, totalInterviews, completedInterviews } = fullStoryData;

//   // Simulate processing time
//   const processingTime = Math.floor(Math.random() * 3000) + 2000; // 2-5 seconds

//   // Aggregate content from all approved drafts
//   const allSections = [];
//   const allThemes = [];
//   const allTranscriptions = [];
//   let totalWords = 0;

//   approvedDrafts.forEach((draft, index) => {
//     const draftContent = draft.draft?.content || {};

//     // Collect sections
//     if (draftContent.sections) {
//       Object.entries(draftContent.sections).forEach(([key, value]) => {
//         allSections.push({
//           source: `Interview ${index + 1} (${draft.interviewName})`,
//           section: key,
//           content: value
//         });
//       });
//     }

//     // Collect themes
//     if (draftContent.keyThemes) {
//       allThemes.push(...draftContent.keyThemes.map(theme => ({
//         theme,
//         source: draft.interviewName
//       })));
//     }

//     // Collect transcriptions
//     if (draft.transcription) {
//       allTranscriptions.push({
//         source: draft.interviewName,
//         content: draft.transcription,
//         duration: draft.duration
//       });
//     }

//     // Count words
//     if (draftContent.summary) {
//       totalWords += draftContent.summary.split(' ').length;
//     }
//   });

//   // Generate comprehensive life story
//   const fullLifeStory = {
//     title: `The Life Story of ${clientInfo.name}`,
//     subtitle: `A Comprehensive Journey Through ${completedInterviews} Life Interviews`,

//     content: {
//       introduction: {
//         overview: `This comprehensive life story of ${clientInfo.name} has been carefully crafted from ${approvedDrafts.length} approved interview drafts, representing ${completedInterviews} completed interviews out of ${totalInterviews} total sessions. Through these conversations, we have captured the essence of a remarkable life journey spanning ${clientInfo.age} years.`,
//         methodology: `Each interview was professionally conducted, transcribed, and analyzed using advanced AI technology to extract key themes, memorable moments, and significant life events. The approved drafts have been synthesized into this cohesive narrative that honors ${clientInfo.name}'s unique story.`,
//         acknowledgments: `Special thanks to all who participated in the interview process and contributed to preserving these precious memories.`
//       },

//       chapters: [
//         {
//           title: "Early Life and Foundation",
//           content: allSections.filter(s => s.section.includes('early') || s.section.includes('childhood') || s.section.includes('family')).map(s => s.content).join('\n\n') || `${clientInfo.name}'s early years were marked by formative experiences that would shape the person they became. Through our interviews, we discovered the foundational moments that established their character and values.`,
//           sources: allSections.filter(s => s.section.includes('early') || s.section.includes('childhood')).map(s => s.source)
//         },
//         {
//           title: "Career and Professional Journey",
//           content: allSections.filter(s => s.section.includes('career') || s.section.includes('work') || s.section.includes('professional')).map(s => s.content).join('\n\n') || `The professional life of ${clientInfo.name} reflects dedication, growth, and significant contributions to their field. Their career journey demonstrates resilience and adaptability through changing times.`,
//           sources: allSections.filter(s => s.section.includes('career') || s.section.includes('work')).map(s => s.source)
//         },
//         {
//           title: "Relationships and Family",
//           content: allSections.filter(s => s.section.includes('relationship') || s.section.includes('family') || s.section.includes('marriage')).map(s => s.content).join('\n\n') || `The relationships that ${clientInfo.name} built throughout their life form the heart of their story. From family bonds to friendships, these connections provided meaning and joy.`,
//           sources: allSections.filter(s => s.section.includes('relationship') || s.section.includes('family')).map(s => s.source)
//         },
//         {
//           title: "Life Lessons and Wisdom",
//           content: allSections.filter(s => s.section.includes('wisdom') || s.section.includes('lesson') || s.section.includes('advice')).map(s => s.content).join('\n\n') || `Through decades of experience, ${clientInfo.name} has accumulated profound wisdom and insights. These life lessons offer guidance and inspiration for future generations.`,
//           sources: allSections.filter(s => s.section.includes('wisdom') || s.section.includes('lesson')).map(s => s.source)
//         },
//         {
//           title: "Legacy and Reflections",
//           content: `As we conclude this comprehensive life story, we reflect on the remarkable legacy of ${clientInfo.name}. Their journey through ${clientInfo.age} years has been marked by resilience, love, achievement, and wisdom. This story will serve as a lasting tribute to a life well-lived and memories well-preserved.`,
//           sources: approvedDrafts.map(d => d.interviewName)
//         }
//       ],

//       appendices: {
//         interviewSummary: {
//           totalInterviews,
//           completedInterviews,
//           approvedDrafts: approvedDrafts.length,
//           totalDuration: approvedDrafts.reduce((sum, d) => sum + (d.duration || 0), 0),
//           interviewDetails: approvedDrafts.map(d => ({
//             name: d.interviewName,
//             duration: d.duration,
//             hasTranscription: !!d.transcription,
//             hasDraft: !!d.draft
//           }))
//         },
//         keyThemes: [...new Set(allThemes.map(t => t.theme))].slice(0, 10),
//         sessionNotes: sessionNotes || 'No additional session notes provided.'
//       },

//       totalWords: totalWords + 2000, // Add estimated words from generated content
//       estimatedPages: Math.ceil((totalWords + 2000) / 250),
//       generationSummary: `This life story was generated from ${approvedDrafts.length} approved interview drafts, combining AI analysis with human curation to create a comprehensive narrative of ${clientInfo.name}'s remarkable life journey.`
//     },

//     metadata: {
//       generatedAt: new Date().toISOString(),
//       processingTime,
//       aiModel: 'mock-ai-v1.0',
//       sourceInterviews: approvedDrafts.length,
//       totalInterviews,
//       completedInterviews,
//       clientAge: clientInfo.age,
//       language: clientInfo.preferences?.preferred_language || 'en',
//       version: '1.0.0'
//     }
//   };

//   console.log(`✅ Mock AI: Generated full life story with ${fullLifeStory.content.totalWords} words in ${processingTime}ms`);

//   return fullLifeStory;
// };

module.exports = {
  // Core AI functions
  transcribeAudio,
  processText,
  generateDraft,
  generateFullLifeStory,
  processInterviewFile,

  // Utility functions
  healthCheck,
  getConfig,
  updateConfig,

  // Internal functions (for testing)
  _internal: {
    callAIEndpoint,
    uploadFileToAI,
    withRetry,
    mockTranscribeAudio,
    mockProcessText,
    mockGenerateDraft,
    // mockGenerateFullLifeStory
  }
};
