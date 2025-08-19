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
const uploadFileToAI = async (file, filePath, operation, metadata = {}) => {
  if (config.ai.mockMode) {
    return mockTranscribeAudio(filePath);
  }

  console.log('🚀 Calling real AI audio transcription endpoint...');
  const mockFileUrl = `https://res.cloudinary.com/dollaguij/video/upload/v1755613453/herzog-audio5_r2b6m7.mp3`;

  // Use the specific AI_DRAFT_GENERETOR_ENDPOINT_URL for draft generation
  const audioTranscriptionEndpointUrl = process.env.AI_UPLOAD_RECORDINGS_ENDPOINT_URL;

  if (!audioTranscriptionEndpointUrl) {
    throw new Error('AI_AUDIO_TRANSCRIPTION_ENDPOINT_URL is not configured');
  }

  const payload = {
    // file,
    fileUrl: mockFileUrl,
    operation,
    metadata
  };

  // console.log('PAYLOAD:', payload);

  const response = await axios.post(audioTranscriptionEndpointUrl, payload, {
    headers: {
      'Content-Type': 'application/json',
      ...(process.env.AI_API_KEY && { 'Authorization': `Bearer ${process.env.AI_API_KEY}` })
    },
    timeout: parseInt(process.env.AI_REQUEST_TIMEOUT) || 60000
  });

  const result = response.data;
  console.log('✅ Real AI audio transcription completed successfully');

  // const formData = new FormData();
  // formData.append('file', fs.createReadStream(filePath));
  // formData.append('operation', operation);
  // formData.append('metadata', JSON.stringify(metadata));
  // formData.append('timestamp', new Date().toISOString());

  // const headers = {
  //   ...formData.getHeaders(),
  // };

  // // Add API key if configured
  // if (config.ai.apiKey) {
  //   headers['Authorization'] = `Bearer ${config.ai.apiKey}`;
  // }

  // console.log(`🤖 Uploading file to AI endpoint for ${operation}:`, filePath);

  // const response = await axios.post(config.ai.endpointUrl, formData, {
  //   headers,
  //   timeout: config.ai.requestTimeout,
  // });

  if (response.status !== 200) {
    throw new Error(`AI endpoint returned status ${response.status}: ${response.statusText}`);
  }

  return response.data;
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
const transcribeAudio = async (file, audioFilePath) => {
  if (config.ai.mockMode) {
    return mockTranscribeAudio(audioFilePath);
  }

  return withRetry(async () => {
    const result = await uploadFileToAI(file, audioFilePath, 'transcribe', {
      fileType: 'audio',
      language: 'auto-detect', // or specific language code
    });

    console.log('✅ Real AI transcription completed');
    return result.transcription || result.text || result.content;
  });
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
  if (config.ai.mockMode) {
    return mockGenerateDraft(content, interviewMetadata);
  }

  return withRetry(async () => {
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
        notes: interviewMetadata.notes
      },
      preferences: {
        language: interviewMetadata.preferred_language,
      }
    };

    // console.log('PAYLOAD:', payload);

    const response = await axios.post(draftEndpointUrl, payload, {
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.AI_API_KEY && { 'Authorization': `Bearer ${process.env.AI_API_KEY}` })
      },
      timeout: parseInt(process.env.AI_REQUEST_TIMEOUT) || 60000
    });

    const result = response.data;
    console.log('✅ Real AI draft generation completed successfully');

    // Extract the actual AI content from various possible fields
    let aiGeneratedContent = '';

    if (result.output) {
      // Handle output field with markdown code blocks
      let outputContent = result.output;

      // Remove markdown code blocks if present
      if (outputContent.includes('```json') && outputContent.includes('```')) {
        const jsonMatch = outputContent.match(/```json\n([\s\S]*?)\n```/);
        if (jsonMatch) {
          try {
            const parsedOutput = JSON.parse(jsonMatch[1]);
            aiGeneratedContent = parsedOutput.summary_markdown || parsedOutput.content || parsedOutput.summary || '';
          } catch (e) {
            aiGeneratedContent = outputContent;
          }
        } else {
          aiGeneratedContent = outputContent;
        }
      } else {
        aiGeneratedContent = outputContent;
      }
    } else {
      // Fallback to other fields
      aiGeneratedContent = result.message?.content || result.content || '';
    }

    // Try to parse the AI content as JSON if it looks like structured data
    let parsedContent = null;
    try {
      if (aiGeneratedContent.startsWith('{') || aiGeneratedContent.startsWith('[')) {
        parsedContent = JSON.parse(aiGeneratedContent);
      }
    } catch (e) {
      // Not JSON, continue with text parsing
    }

    // Extract sections from the structured content
    let extractedSections = {};
    let extractedKeywords = [];
    let extractedSummary = '';
    let extractedFollowUps = [];
    let extractedToVerify = { people: [], places: [], organizations: [], dates: [] };
    let extractedCategories = [];

    // Function to extract follow-ups from text with improved patterns
    const extractFollowUpsFromText = (text) => {
      const followUps = [];

      // Multiple patterns to match Follow-ups section with more flexibility
      const patterns = [
        /\*\*Follow-ups\*\*:\s*\n((?:\s*\d+\..*?\n?)*)/gi,
        /Follow-ups\*\*:\s*\n((?:\s*\d+\..*?\n?)*)/gi,
        /- \*\*Follow-ups\*\*:\s*\n((?:\s*\d+\..*?\n?)*)/gi,
        /\*\*Follow-ups\*\*:([\s\S]*?)(?=\*\*[^*]|\n- \*\*|$)/gi,
        /Follow-ups\*\*:([\s\S]*?)(?=\*\*[^*]|\n- \*\*|$)/gi,
        /- \*\*Follow-ups\*\*:([\s\S]*?)(?=\*\*[^*]|\n- \*\*|$)/gi
      ];

      let followUpMatch = null;
      let matchedPattern = -1;

      for (let i = 0; i < patterns.length; i++) {
        const pattern = patterns[i];
        followUpMatch = text.match(pattern);
        if (followUpMatch) {
          matchedPattern = i;
          break;
        }
      }

      if (followUpMatch) {
        const followUpText = followUpMatch[0];

        // Extract numbered questions with multiple patterns
        const questionPatterns = [
          /\s*\d+\.\s+([^\n]+?)(?=\n\s*\d+\.|\n\*\*|\n-|$)/g,
          /\s*\d+\.\s*([^\n\\]+)/g,
          /\s*\d+\.\s+(.+?)(?=\\\n|\n|$)/g
        ];

        let questions = null;
        for (const qPattern of questionPatterns) {
          questions = [...followUpText.matchAll(qPattern)];
          if (questions.length > 0) {
            break;
          }
        }

        if (questions && questions.length > 0) {
          questions.forEach((match, index) => {
            const question = match[1] ? match[1].trim() : '';
            // console.log(`Question ${index + 1}:`, question);
            if (question && question.length > 5) {
              followUps.push(question);
            }
          });
        } else {
          // Fallback: look for any line that looks like a question
          const lines = followUpText.split(/\\n|\n/);
          lines.forEach(line => {
            // Handle both regular and escaped newlines
            const normalizedLine = line.replace(/\\n/g, '\n');
            const cleanLine = normalizedLine.replace(/^\s*\d+\.\s*/, '').trim();
            if (cleanLine.includes('?') && cleanLine.length > 10) {
              followUps.push(cleanLine);
            }
          });
        }
      } else {
        // Additional fallback: look for numbered questions anywhere in the text
        // Handle both regular newlines and escaped newlines
        const normalizedText = text.replace(/\\n/g, '\n');
        const globalQuestionPattern = /\s*\d+\.\s+([^\n]*\?[^\n]*)/g;
        const globalMatches = [...normalizedText.matchAll(globalQuestionPattern)];
        globalMatches.forEach(match => {
          const question = match[1].trim();
          if (question && question.length > 10) {
            followUps.push(question);
          }
        });

        // If still no matches, try splitting by escaped newlines and look for questions
        if (followUps.length === 0) {
          const lines = text.split(/\\n|\n/);
          lines.forEach(line => {
            const trimmedLine = line.trim();
            // Look for numbered questions
            const questionMatch = trimmedLine.match(/^\s*\d+\.\s+(.+\?.*)/);
            if (questionMatch) {
              const question = questionMatch[1].trim();
              if (question.length > 10) {
                followUps.push(question);
              }
            }
          });
        }
      }

      return followUps;
    };

    // Function to extract verification data from text with improved table parsing
    const extractToVerifyFromText = (text) => {
      const toVerify = { people: [], places: [], organizations: [], dates: [] };
      // Multiple patterns to match To-Verify section
      const patterns = [
        /\*\*To-Verify\*\*:([\s\S]*?)(?=\*\*[^*]|\n- \*\*|$)/gi,
        /To-Verify\*\*:([\s\S]*?)(?=\*\*[^*]|\n- \*\*|$)/gi,
        /- \*\*To-Verify\*\*:([\s\S]*?)(?=\*\*[^*]|\n- \*\*|$)/gi
      ];

      let toVerifyMatch = null;
      for (const pattern of patterns) {
        toVerifyMatch = text.match(pattern);
        if (toVerifyMatch) {
          break;
        }
      }

      if (toVerifyMatch) {
        const toVerifyText = toVerifyMatch[0];

        // Look for table structure - handle both complete and incomplete tables
        const normalizedToVerifyText = toVerifyText.replace(/\\n/g, '\n');
        const tableLines = normalizedToVerifyText.split('\n').filter(line => line.includes('|'));

        if (tableLines.length > 0) {
          // Find header row to understand column structure
          let headerIndex = -1;
          let columnMapping = {};

          for (let i = 0; i < tableLines.length; i++) {
            const line = tableLines[i];
            if (line.toLowerCase().includes('people') ||
              line.toLowerCase().includes('places') ||
              line.toLowerCase().includes('organizations') ||
              line.toLowerCase().includes('dates')) {
              headerIndex = i;

              // Parse header to understand column positions
              const headers = line.split('|').map(h => h.trim().toLowerCase());
              headers.forEach((header, index) => {
                if (header.includes('people')) columnMapping.people = index;
                if (header.includes('places')) columnMapping.places = index;
                if (header.includes('organizations')) columnMapping.organizations = index;
                if (header.includes('dates')) columnMapping.dates = index;
              });
              break;
            }
          }

          // Process data rows
          for (let i = headerIndex + 1; i < tableLines.length; i++) {
            const line = tableLines[i];
            if (line.includes('---')) continue; // Skip separator rows

            const cells = line.split('|').map(cell => cell.trim()).filter(cell => cell && cell.length > 0);

            if (cells.length >= 1) {
              // First approach: try to use column mapping
              if (Object.keys(columnMapping).length > 0) {
                if (columnMapping.people !== undefined && cells[columnMapping.people]) {
                  const person = cells[columnMapping.people];
                  if (person && person !== 'People') {
                    toVerify.people.push({ name: person, context: 'Mentioned in interview', verified: false });
                  }
                }

                if (columnMapping.places !== undefined && cells[columnMapping.places]) {
                  const place = cells[columnMapping.places];
                  if (place && place !== 'Places') {
                    toVerify.places.push({ name: place, context: 'Location mentioned', verified: false });
                  }
                }

                if (columnMapping.organizations !== undefined && cells[columnMapping.organizations]) {
                  const org = cells[columnMapping.organizations];
                  if (org && org !== 'Organizations') {
                    toVerify.organizations.push({ name: org, context: 'Organization mentioned', verified: false });
                  }
                }

                if (columnMapping.dates !== undefined && cells[columnMapping.dates]) {
                  const date = cells[columnMapping.dates];
                  if (date && date !== 'Dates') {
                    toVerify.dates.push({ date: date, context: 'Time period mentioned', verified: false });
                  }
                }
              } else {
                // Fallback: process each cell as potential entity
                cells.forEach((cell, index) => {
                  if (cell && cell.length > 1 && !cell.toLowerCase().includes('people') && !cell.toLowerCase().includes('organizations') && !cell.toLowerCase().includes('places') && !cell.toLowerCase().includes('dates')) {
                    // Try to categorize the entity
                    if (cell.includes('רב') || cell.includes('הרב') || cell.match(/\b[A-Z][a-z]+ [A-Z][a-z]+\b/)) {
                      toVerify.people.push({ name: cell, context: 'Mentioned in interview', verified: false });
                    } else if (cell.match(/University|Academy|ישיבת|ישיבה|School|Company/i)) {
                      toVerify.organizations.push({ name: cell, context: 'Organization mentioned', verified: false });
                    } else if (cell.match(/^[א-ת\s]+$/) || cell.match(/^[A-Za-z\s]+$/)) {
                      // Hebrew or English text that looks like a place
                      toVerify.places.push({ name: cell, context: 'Location mentioned', verified: false });
                    }
                  }
                });
              }
            }
          }
        } else {
          // Additional fallback: look for entities in simple table format without proper headers
          const normalizedText = toVerifyText.replace(/\\n/g, '\n');
          const simpleTableLines = normalizedText.split('\n').filter(line => line.includes('|') && line.trim() !== '');

          simpleTableLines.forEach(line => {
            if (!line.includes('---') && !line.toLowerCase().includes('people') && !line.toLowerCase().includes('places') && !line.toLowerCase().includes('organizations')) {
              const cells = line.split('|').map(cell => cell.trim()).filter(cell => cell && cell.length > 0);

              cells.forEach(cell => {
                if (cell && cell.length > 1 && !cell.toLowerCase().includes('dates')) {
                  // Categorize based on content patterns
                  if (cell.includes('רב') || cell.includes('הרב') || cell.match(/\b[A-Z][a-z]+ [A-Z][a-z]+\b/)) {
                    toVerify.people.push({ name: cell, context: 'Mentioned in interview', verified: false });
                  } else if (cell.match(/University|Academy|Bootcamp|School|High School|ישיבת|ישיבה|תיכון/i)) {
                    toVerify.organizations.push({ name: cell, context: 'Organization mentioned', verified: false });
                  } else if (cell.match(/^[א-ת\s]+$/) || cell.match(/^[A-Za-z\s]+$/)) {
                    toVerify.places.push({ name: cell, context: 'Location mentioned', verified: false });
                  }
                }
              });
            }
          });
        }
      } else {
        // Final fallback: look for table data anywhere in the text
        const normalizedText = text.replace(/\\n/g, '\n');
        const tableLines = normalizedText.split('\n').filter(line => line.includes('|') && line.trim() !== '');

        tableLines.forEach(line => {
          if (!line.includes('---') && !line.toLowerCase().includes('people') && !line.toLowerCase().includes('places') && !line.toLowerCase().includes('organizations')) {
            const cells = line.split('|').map(cell => cell.trim()).filter(cell => cell && cell.length > 0);

            cells.forEach(cell => {
              if (cell && cell.length > 1 && !cell.toLowerCase().includes('dates')) {
                // Categorize based on content patterns
                if (cell.includes('רב') || cell.includes('הרב') || cell.match(/\b[A-Z][a-z]+ [A-Z][a-z]+\b/)) {
                  toVerify.people.push({ name: cell, context: 'Mentioned in interview', verified: false });
                } else if (cell.match(/University|Academy|Bootcamp|School|High School|ישיבת|ישיבה|תיכון/i)) {
                  toVerify.organizations.push({ name: cell, context: 'Organization mentioned', verified: false });
                } else if (cell.match(/^[א-ת\s]+$/) || cell.match(/^[A-Za-z\s]+$/)) {
                  toVerify.places.push({ name: cell, context: 'Location mentioned', verified: false });
                }
              }
            });
          }
        });
      }

      return toVerify;
    };

    // Enhanced cleanSectionContent function
    const cleanSectionContent = (text) => {
      // First normalize escaped newlines
      text = text.replace(/\\n/g, '\n');

      // Remove the Follow-ups section with multiple patterns
      text = text.replace(/- \*\*Follow-ups\*\*:[\s\S]*?(?=\n- \*\*|\n\*\*[^*]|$)/gi, '');
      text = text.replace(/\*\*Follow-ups\*\*:[\s\S]*?(?=\n- \*\*|\n\*\*[^*]|$)/gi, '');

      // Remove the To-Verify section with multiple patterns  
      text = text.replace(/- \*\*To-Verify\*\*:[\s\S]*?(?=\n- \*\*|\n\*\*[^*]|$)/gi, '');
      text = text.replace(/\*\*To-Verify\*\*:[\s\S]*?(?=\n- \*\*|\n\*\*[^*]|$)/gi, '');

      // Remove other metadata
      text = text.replace(/- \*\*Title\*\*:.*?\n/g, '');
      text = text.replace(/\*\*Title\*\*:.*?\n/g, '');
      text = text.replace(/- \*\*Keywords\*\*:.*?\n/g, '');
      text = text.replace(/\*\*Keywords\*\*:.*?\n/g, '');

      // Remove any remaining metadata patterns that might be missed
      text = text.replace(/\n\s*-\s*\*\*[^*]+\*\*:.*$/gm, '');
      text = text.replace(/\n\s*\*\*[^*]+\*\*:.*$/gm, '');

      return text.trim();
    };

    // Updated section processing to handle embedded metadata better
    const processAllSections = (extractedSections) => {
      let allFollowUps = [];
      let allToVerify = { people: [], places: [], organizations: [], dates: [] };
      const cleanedSections = {};

      for (const [sectionKey, sectionText] of Object.entries(extractedSections)) {
        // Extract follow-ups from this section
        const sectionFollowUps = extractFollowUpsFromText(sectionText);
        if (sectionFollowUps.length > 0) {
          allFollowUps = [...allFollowUps, ...sectionFollowUps];
        }

        // Extract verification data from this section
        const sectionToVerify = extractToVerifyFromText(sectionText);
        const hasVerificationData = sectionToVerify.people.length > 0 ||
          sectionToVerify.places.length > 0 ||
          sectionToVerify.organizations.length > 0 ||
          sectionToVerify.dates.length > 0;

        if (hasVerificationData) {
          allToVerify.people = [...allToVerify.people, ...sectionToVerify.people];
          allToVerify.places = [...allToVerify.places, ...sectionToVerify.places];
          allToVerify.organizations = [...allToVerify.organizations, ...sectionToVerify.organizations];
          allToVerify.dates = [...allToVerify.dates, ...sectionToVerify.dates];
        }

        // Clean the section content by removing metadata
        let cleanedContent = cleanSectionContent(sectionText);

        // Only include section if it has meaningful content after cleaning
        if (cleanedContent.trim().length > 10) {
          cleanedSections[sectionKey] = cleanedContent;
        }
      }

      // Remove duplicates
      allFollowUps = [...new Set(allFollowUps)];

      // Remove duplicate verification items
      allToVerify.people = allToVerify.people.filter((person, index, self) =>
        index === self.findIndex(p => p.name === person.name)
      );
      allToVerify.places = allToVerify.places.filter((place, index, self) =>
        index === self.findIndex(p => p.name === place.name)
      );
      allToVerify.organizations = allToVerify.organizations.filter((org, index, self) =>
        index === self.findIndex(o => o.name === org.name)
      );
      allToVerify.dates = allToVerify.dates.filter((date, index, self) =>
        index === self.findIndex(d => d.date === date.date)
      );

      return {
        sections: cleanedSections,
        followUps: allFollowUps,
        toVerify: allToVerify
      };
    };

    // Handle both actual newlines and escaped newlines for all content processing
    const normalizedContent = aiGeneratedContent ? aiGeneratedContent.replace(/\\n/g, '\n') : '';

    if (parsedContent) {
      // Use the structured content directly
      extractedSections = parsedContent.sections || {};
      extractedKeywords = parsedContent.keywords || parsedContent.keyThemes || [];
      extractedSummary = parsedContent.summary || parsedContent.content || '';
      extractedFollowUps = parsedContent.followUps || parsedContent['follow-ups'] || [];
      extractedToVerify = parsedContent.toVerify || parsedContent['to-verify'] || { people: [], places: [], organizations: [], dates: [] };
      extractedCategories = parsedContent.categories || [];

      // Process all sections to extract embedded metadata and clean content
      const processedData = processAllSections(extractedSections);
      extractedSections = processedData.sections;
      extractedFollowUps = [...extractedFollowUps, ...processedData.followUps];
      extractedToVerify = {
        people: [...extractedToVerify.people, ...processedData.toVerify.people],
        places: [...extractedToVerify.places, ...processedData.toVerify.places],
        organizations: [...extractedToVerify.organizations, ...processedData.toVerify.organizations],
        dates: [...extractedToVerify.dates, ...processedData.toVerify.dates]
      };

    } else if (aiGeneratedContent) {
      // Parse markdown-style content manually
      const contentLines = normalizedContent.split('\n');
      let currentSection = '';
      let sectionContent = '';
      let inFollowUps = false;
      let inToVerify = false;
      let toVerifyTable = { people: [], places: [], organizations: [], dates: [] };

      for (const line of contentLines) {
        if (line.startsWith('# ') || line.startsWith('## ') || line.startsWith('### ')) {
          // Save previous section
          if (currentSection && sectionContent) {
            extractedSections[currentSection] = sectionContent.trim();
          }
          // Start new section
          currentSection = line.replace(/^#{1,3} /, '').trim();
          sectionContent = '';

          // Reset special section flags for regular markdown headers
          inFollowUps = false;
          inToVerify = false;

          // Check if we're entering special sections
          inFollowUps = currentSection.toLowerCase().includes('follow') && currentSection.toLowerCase().includes('up');
          inToVerify = currentSection.toLowerCase().includes('verify') || currentSection.toLowerCase().includes('to-verify');
        } else if (line.startsWith('Follow-ups:') || line.startsWith('Follow-Ups:')) {
          // Save previous section before switching
          if (currentSection && sectionContent) {
            extractedSections[currentSection] = sectionContent.trim();
          }
          // Handle Follow-ups section without markdown header
          inFollowUps = true;
          inToVerify = false;
          currentSection = 'Follow-ups';
          sectionContent = '';
        } else if (line.startsWith('To-Verify:') || line.startsWith('To-verify:')) {
          // Save previous section before switching
          if (currentSection && sectionContent) {
            extractedSections[currentSection] = sectionContent.trim();
          }
          // Handle To-Verify section without markdown header
          inToVerify = true;
          inFollowUps = false;
          currentSection = 'To-Verify';
          sectionContent = '';
        } else if (inFollowUps && line.match(/^\d+\./)) {
          // Extract follow-up questions
          const followUpText = line.replace(/^\d+\.\s*/, '').trim();
          if (followUpText) {
            extractedFollowUps.push(followUpText);
          }
        } else if (inToVerify && line.includes('|') && !line.startsWith('|---')) {
          // Parse To-Verify table rows
          const allCells = line.split('|').map(cell => cell.trim());
          // Remove empty cells from start/end but keep internal empty cells
          const cells = allCells.slice(1, -1); // Remove first and last empty cells from | ... |

          // Skip header row
          if (!line.toLowerCase().includes('people') && !line.toLowerCase().includes('places') && cells.length > 0) {
            // Process data rows - handle variable number of cells
            const people = cells[0] || '';
            const places = cells[1] || '';
            const organizations = cells[2] || '';
            const dates = cells[3] || '';

            // Add non-empty values to appropriate arrays
            if (people && people !== '' && people !== 'People') toVerifyTable.people.push(people);
            if (places && places !== '' && places !== 'Places') toVerifyTable.places.push(places);
            if (organizations && organizations !== '' && organizations !== 'Organizations') toVerifyTable.organizations.push(organizations);
            if (dates && dates !== '' && dates !== 'Dates') toVerifyTable.dates.push(dates);
          }
        } else if (line.startsWith('- ') && (currentSection.includes('Keywords') || currentSection.includes('keywords'))) {
          // Extract keywords
          extractedKeywords.push(line.replace('- ', '').trim());
        } else if (line.match(/^\d+\./)) {
          // Handle numbered lists (like follow-ups)
          if (currentSection && line.trim()) {
            sectionContent += line + '\\n';
          }
        } else if (currentSection && line.trim()) {
          sectionContent += line + '\\n';
        }
      }

      // Save last section
      if (currentSection && sectionContent) {
        extractedSections[currentSection] = sectionContent.trim();
      }

      // Process all sections to extract embedded metadata and clean content
      const processedData = processAllSections(extractedSections);
      extractedSections = processedData.sections;
      extractedFollowUps = [...extractedFollowUps, ...processedData.followUps];
      extractedToVerify = {
        people: [...extractedToVerify.people, ...processedData.toVerify.people],
        places: [...extractedToVerify.places, ...processedData.toVerify.places],
        organizations: [...extractedToVerify.organizations, ...processedData.toVerify.organizations],
        dates: [...extractedToVerify.dates, ...processedData.toVerify.dates]
      };

      // Set extracted To-Verify data if any was found in manual parsing
      if (toVerifyTable.people.length > 0 || toVerifyTable.places.length > 0 ||
        toVerifyTable.organizations.length > 0 || toVerifyTable.dates.length > 0) {
        extractedToVerify.people = [...extractedToVerify.people, ...toVerifyTable.people];
        extractedToVerify.places = [...extractedToVerify.places, ...toVerifyTable.places];
        extractedToVerify.organizations = [...extractedToVerify.organizations, ...toVerifyTable.organizations];
        extractedToVerify.dates = [...extractedToVerify.dates, ...toVerifyTable.dates];
      }

      // Extract title from the content
      let extractedTitle = '';
      if (normalizedContent.includes('**Title**:')) {
        const titleMatch = normalizedContent.match(/\*\*Title\*\*:\s*([^\n]+)/i);
        if (titleMatch) {
          extractedTitle = titleMatch[1].trim();
        }
      }

      // Extract keywords from the content - handle multiple formats
      if (normalizedContent.includes('Keywords:') || normalizedContent.includes('**Keywords**:')) {
        // Handle format: - **Keywords**: word1, word2, word3
        const keywordsMatch = normalizedContent.match(/\*\*Keywords\*\*:\s*([^\n]+)/i) ||
          normalizedContent.match(/Keywords:\s*([^\n]+)/i);
        if (keywordsMatch) {
          const keywordsList = keywordsMatch[1].split(',').map(k => k.trim());
          extractedKeywords.push(...keywordsList);
        }
      }

      // Set extracted title if found
      if (extractedTitle) {
        extractedSummary = extractedTitle; // Use title as summary if no other summary
      }

      // Use the main content as summary if no explicit summary
      const sectionKeys = Object.keys(extractedSections);
      if (sectionKeys.length > 0 && !extractedSummary) {
        // Filter out special sections and use actual story content
        const storyKeys = sectionKeys.filter(key =>
          !key.toLowerCase().includes('follow') &&
          !key.toLowerCase().includes('verify') &&
          !key.toLowerCase().includes('keyword')
        );
        if (storyKeys.length > 0) {
          extractedSummary = extractedSections[storyKeys[0]];
        } else {
          extractedSummary = aiGeneratedContent.substring(0, 500) + '...';
        }
      }
    }

    // Calculate word count from the actual content
    const totalContent = Object.values(extractedSections).join(' ') + ' ' + extractedSummary;
    const calculatedWordCount = totalContent.split(/\s+/).filter(word => word.length > 0).length;
    const estimatedReadingTime = Math.max(1, Math.ceil(calculatedWordCount / 250)); // 250 words per minute

    // Extract title from AI content or use default
    let finalTitle = '';
    if (normalizedContent && normalizedContent.includes('**Title**:')) {
      const titleMatch = normalizedContent.match(/\*\*Title\*\*:\s*([^\n]+)/i);
      if (titleMatch) {
        finalTitle = titleMatch[1].trim();
      }
    }

    if (!finalTitle) {
      finalTitle = parsedContent?.title || result.title || `Life Story Draft - ${interviewMetadata.name || interviewMetadata.clientName || 'Interview'} ${new Date().toLocaleDateString()}`;
    }

    // Normalize the response format to match expected structure
    const normalizedDraft = {
      title: finalTitle,
      content: {
        summary: extractedSummary || aiGeneratedContent.substring(0, 200) + '...' || 'AI-generated summary from real endpoint',
        sections: Object.keys(extractedSections).length > 0 ?
          // Filter out sections with minimal/empty content
          Object.fromEntries(
            Object.entries(extractedSections).filter(([key, content]) => {
              const cleanContent = content.trim();
              // Remove sections that are just "|", empty, or contain only special characters/whitespace
              return cleanContent.length > 2 &&
                cleanContent !== '|' &&
                cleanContent !== '||' &&
                cleanContent !== '|||' &&
                !(/^[\s\|\-\*\#]*$/.test(cleanContent)) && // Only whitespace, pipes, dashes, asterisks, hashes
                !key.toLowerCase().includes('to-verify') && // Remove To-Verify sections
                !key.toLowerCase().includes('toverify');
            })
          ) : {
            introduction: 'AI-generated introduction',
            mainStory: aiGeneratedContent || 'AI-generated main story',
            conclusion: 'AI-generated conclusion'
          },
        keyThemes: extractedKeywords.length > 0 ? extractedKeywords : [],
        followUps: extractedFollowUps.length > 0 ? extractedFollowUps : [],
        toVerify: Object.keys(extractedToVerify).length > 0 ? extractedToVerify : {},
        categories: extractedCategories.length > 0 ? extractedCategories : [],
        metadata: {
          wordCount: calculatedWordCount,
          estimatedReadingTime: `${estimatedReadingTime} minutes`,
          generatedAt: new Date().toISOString(),
          sourceInterview: interviewMetadata.id,
          processingMethod: 'AI_REAL_GENERATION',
          aiModel: result.model || result.aiModel || 'n8n-endpoint',
          confidence: result.confidence || null,
          endpointUrl: draftEndpointUrl
        }
      },
      status: result.status || 'draft',
      version: result.version || '1.0',
      createdAt: new Date().toISOString()
    };

    return normalizedDraft;
  });
};

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
    // console.log('🔍 RAW AI ENDPOINT RESPONSE:', JSON.stringify(result, null, 2));

    // Extract and parse AI content from response
    let aiContent = result;

    // Handle direct output field (n8n workflow response)
    if (result.output) {
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
      // Extract title from first markdown header (# Title)
      const titleMatch = aiContent.match(/^\s*#\s+(.+?)\s*$/m);
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
