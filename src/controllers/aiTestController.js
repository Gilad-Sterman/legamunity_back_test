/**
 * AI Test Controller
 * Provides endpoints for testing AI service integration
 */

const aiService = require('../services/aiService');

/**
 * Test AI service health and configuration
 * GET /api/ai/health
 */
const healthCheck = async (req, res) => {
  try {
    const health = await aiService.healthCheck();
    const config = aiService.getConfig();
    
    // Debug: Show environment variables
    const envDebug = {
      AI_ENDPOINT_URL: process.env.AI_ENDPOINT_URL || 'NOT_SET',
      AI_RECORDINGS_ENDPOINT_URL: process.env.AI_RECORDINGS_ENDPOINT_URL || 'NOT_SET',
      AI_MOCK_MODE: process.env.AI_MOCK_MODE || 'NOT_SET',
      NODE_ENV: process.env.NODE_ENV || 'NOT_SET'
    };
    
    res.json({
      success: true,
      health,
      config,
      environmentVariables: envDebug,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('AI health check failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Test transcription functionality
 * POST /api/ai/test-transcribe
 */
const testTranscribe = async (req, res) => {
  try {
    const { mockFilePath } = req.body;
    const filePath = mockFilePath || 'test-audio-file.mp3';
    
    console.log('🧪 Testing transcription with file:', filePath);
    const result = await aiService.transcribeAudio(filePath);
    
    res.json({
      success: true,
      operation: 'transcribe',
      result,
      mode: aiService.getConfig().mockMode ? 'mock' : 'real',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Transcription test failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      operation: 'transcribe',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Test text processing functionality
 * POST /api/ai/test-process
 */
const testProcess = async (req, res) => {
  try {
    const { textContent } = req.body;
    const content = textContent || 'This is a test text for processing by the AI service.';
    
    console.log('🧪 Testing text processing');
    const result = await aiService.processText(content);
    
    res.json({
      success: true,
      operation: 'process',
      input: content,
      result,
      mode: aiService.getConfig().mockMode ? 'mock' : 'real',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Text processing test failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      operation: 'process',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Test draft generation functionality
 * POST /api/ai/test-generate
 */
const testGenerate = async (req, res) => {
  try {
    const { content, interviewMetadata } = req.body;
    
    const testContent = content || 'This is test interview content that will be used to generate a life story draft.';
    const testMetadata = interviewMetadata || {
      id: 'test-interview-001',
      name: 'Test Interview',
      type: 'life_story',
      duration: 30,
      wordCount: 150
    };
    
    console.log('🧪 Testing draft generation');
    const result = await aiService.generateDraft(testContent, testMetadata);
    
    res.json({
      success: true,
      operation: 'generate',
      input: { content: testContent, metadata: testMetadata },
      result,
      mode: aiService.getConfig().mockMode ? 'mock' : 'real',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Draft generation test failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      operation: 'generate',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Test complete workflow
 * POST /api/ai/test-workflow
 */
const testWorkflow = async (req, res) => {
  try {
    const { filePath, interviewData } = req.body;
    
    const testFilePath = filePath || 'test-interview.mp3';
    const testInterviewData = interviewData || {
      id: 'test-interview-workflow-001',
      name: 'Test Workflow Interview',
      type: 'complete_workflow_test',
      duration: 45,
      wordCount: 200
    };
    
    console.log('🧪 Testing complete AI workflow');
    const result = await aiService.processInterviewFile(testFilePath, testInterviewData);
    
    res.json({
      success: true,
      operation: 'complete_workflow',
      input: { filePath: testFilePath, interviewData: testInterviewData },
      result,
      mode: aiService.getConfig().mockMode ? 'mock' : 'real',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Complete workflow test failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      operation: 'complete_workflow',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Test common n8n webhook path patterns
 * POST /api/ai/test-n8n-patterns
 */
const testN8nPatterns = async (req, res) => {
  try {
    const axios = require('axios');
    
    const { sessionId } = req.body;
    const testSessionId = sessionId || '2a866eff-ec31-498a-a9da-6ff3960405db';
    
    const baseUrl = 'https://adivs.app.n8n.cloud';
    
    // Common n8n webhook path patterns
    const patterns = [
      // Test URLs
      `/webhook-test/sessions/${testSessionId}/recordings`,
      `/webhook-test/sessions/${testSessionId}/recording`,
      `/webhook-test/recordings/${testSessionId}`,
      `/webhook-test/recording/${testSessionId}`,
      `/webhook-test/${testSessionId}/recordings`,
      `/webhook-test/${testSessionId}`,
      
      // Production URLs
      `/webhook/sessions/${testSessionId}/recordings`,
      `/webhook/sessions/${testSessionId}/recording`,
      `/webhook/recordings/${testSessionId}`,
      `/webhook/recording/${testSessionId}`,
      `/webhook/${testSessionId}/recordings`,
      `/webhook/${testSessionId}`
    ];
    
    const results = {};
    let successFound = false;
    
    for (const pattern of patterns) {
      if (successFound) break; // Stop after first success
      
      const fullUrl = baseUrl + pattern;
      console.log(`🧪 Testing n8n pattern: ${fullUrl}`);
      
      try {
        const response = await axios.post(fullUrl, {
          sessionId: testSessionId,
          test: true,
          timestamp: new Date().toISOString(),
          message: 'Pattern test from backend'
        }, {
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Legamunity-Test-Client/1.0'
          },
          timeout: 10000,
          validateStatus: () => true
        });
        
        results[pattern] = {
          status: response.status,
          statusText: response.statusText,
          success: response.status < 400,
          responseData: response.data
        };
        
        if (response.status < 400) {
          console.log(`🎉 SUCCESS! Working pattern: ${fullUrl}`);
          successFound = true;
        } else {
          console.log(`❌ ${pattern}: ${response.status} ${response.statusText}`);
        }
        
      } catch (error) {
        results[pattern] = {
          error: error.message,
          success: false
        };
        console.log(`❌ ${pattern}: ${error.message}`);
      }
    }
    
    const workingPatterns = Object.entries(results).filter(([_, result]) => result.success);
    
    res.json({
      success: workingPatterns.length > 0,
      sessionId: testSessionId,
      workingPatterns: workingPatterns.map(([pattern, result]) => ({
        pattern,
        fullUrl: baseUrl + pattern,
        status: result.status,
        statusText: result.statusText,
        responseData: result.responseData
      })),
      allResults: results,
      recommendations: workingPatterns.length > 0 
        ? `✅ Use this working URL: ${baseUrl}${workingPatterns[0][0]}`
        : '❌ No working patterns found. Check your n8n webhook node configuration.',
      nextSteps: workingPatterns.length === 0 ? [
        'Check the exact "Path" field in your n8n Webhook node',
        'Verify the webhook node is the first node in your workflow',
        'Make sure you clicked "Execute workflow" and it shows "Waiting for webhook call..."',
        'Try activating the workflow for production mode instead'
      ] : [
        'Update your AI service configuration with the working URL',
        'Test the complete AI workflow integration'
      ],
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('n8n patterns test failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Test direct n8n test URL with sessionId substitution
 * POST /api/ai/test-direct-n8n-url
 */
const testDirectN8nUrl = async (req, res) => {
  try {
    const axios = require('axios');
    
    const { sessionId } = req.body;
    const testSessionId = sessionId || '2a866eff-ec31-498a-a9da-6ff3960405db';
    
    // Your specific n8n test URL with sessionId substitution
    const testUrl = `https://adivs.app.n8n.cloud/webhook-test/sessions/${testSessionId}/recordings`;
    
    console.log(`🧪 Testing direct n8n test URL: ${testUrl}`);
    
    const payload = {
      sessionId: testSessionId,
      test: true,
      timestamp: new Date().toISOString(),
      message: 'Direct test from Legamunity backend',
      source: 'backend-test'
    };
    
    try {
      const response = await axios.post(testUrl, payload, {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Legamunity-Test-Client/1.0'
        },
        timeout: 15000,
        validateStatus: () => true
      });
      
      console.log(`✅ Response: ${response.status} ${response.statusText}`);
      if (response.data) {
        console.log(`📄 Response data:`, JSON.stringify(response.data, null, 2));
      }
      
      res.json({
        success: response.status < 400,
        testUrl,
        request: payload,
        response: {
          status: response.status,
          statusText: response.statusText,
          data: response.data,
          headers: {
            'content-type': response.headers['content-type'],
            'server': response.headers['server']
          }
        },
        message: response.status < 400 
          ? '🎉 SUCCESS! n8n test URL is working perfectly!'
          : `❌ Test URL failed with status ${response.status}`,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error(`❌ Direct test URL failed: ${error.message}`);
      
      res.json({
        success: false,
        testUrl,
        request: payload,
        error: {
          message: error.message,
          code: error.code,
          details: error.response?.data
        },
        message: 'Direct test URL failed. Check the error details.',
        timestamp: new Date().toISOString()
      });
    }
    
  } catch (error) {
    console.error('Direct n8n URL test failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Test n8n test URL format (for inactive workflows)
 * POST /api/ai/test-n8n-test-url
 */
const testN8nTestUrl = async (req, res) => {
  try {
    const axios = require('axios');
    
    const { sessionId, workflowId, testWebhookId } = req.body;
    const testSessionId = sessionId || '2a866eff-ec31-498a-a9da-6ff3960405db';
    
    // n8n test URLs typically follow this format:
    // https://adivs.app.n8n.cloud/webhook-test/{workflowId}/{testWebhookId}
    
    const baseUrl = 'https://adivs.app.n8n.cloud';
    
    // If user provides workflow details, test the test URL format
    if (workflowId && testWebhookId) {
      const testUrl = `${baseUrl}/webhook-test/${workflowId}/${testWebhookId}`;
      
      console.log(`🧪 Testing n8n test URL: ${testUrl}`);
      
      try {
        const response = await axios.post(testUrl, {
          sessionId: testSessionId,
          test: true,
          timestamp: new Date().toISOString(),
          message: 'Test from Legamunity backend'
        }, {
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Legamunity-Test-Client/1.0'
          },
          timeout: 15000,
          validateStatus: () => true
        });
        
        return res.json({
          success: response.status < 400,
          testUrl,
          response: {
            status: response.status,
            statusText: response.statusText,
            data: response.data
          },
          message: response.status < 400 
            ? 'n8n test URL is working! Your workflow is probably inactive for production.'
            : 'Test URL also failed. Check your n8n workflow configuration.',
          timestamp: new Date().toISOString()
        });
        
      } catch (error) {
        return res.json({
          success: false,
          testUrl,
          error: error.message,
          message: 'Test URL failed. Please check your workflow ID and test webhook ID.',
          timestamp: new Date().toISOString()
        });
      }
    }
    
    // If no workflow details provided, give instructions
    res.json({
      success: false,
      message: 'To test n8n test URL, please provide workflowId and testWebhookId',
      instructions: {
        step1: 'Go to your n8n workflow',
        step2: 'Click on the Webhook node',
        step3: 'Look for "Test URL" - it will be in format: https://adivs.app.n8n.cloud/webhook-test/{workflowId}/{testWebhookId}',
        step4: 'Extract the workflowId and testWebhookId from that URL',
        step5: 'Call this endpoint again with those values'
      },
      exampleRequest: {
        sessionId: testSessionId,
        workflowId: 'your-workflow-id-here',
        testWebhookId: 'your-test-webhook-id-here'
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('n8n test URL test failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Test multiple path variations for recordings endpoint
 * POST /api/ai/test-recordings-variations
 */
const testRecordingsVariations = async (req, res) => {
  try {
    const axios = require('axios');
    const config = require('../config/config');
    
    const { sessionId } = req.body;
    const testSessionId = sessionId || 'test-session-001';
    
    const baseUrl = 'https://adivs.app.n8n.cloud';
    
    // Test different path variations that n8n might expect
    const pathVariations = [
      `/webhook/sessions/${testSessionId}/recordings`,
      `/webhook/sessions/${testSessionId}/recording`, // singular
      `/sessions/${testSessionId}/recordings`,
      `/sessions/${testSessionId}/recording`,
      `/webhook/${testSessionId}/recordings`,
      `/${testSessionId}/recordings`,
      `/webhook/recording/${testSessionId}`,
      `/webhook/session/${testSessionId}/recordings`
    ];
    
    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'Legamunity-Test-Client/1.0'
    };
    
    if (config.ai.apiKey) {
      headers['Authorization'] = `Bearer ${config.ai.apiKey}`;
    }
    
    const results = {};
    
    for (const path of pathVariations) {
      const fullUrl = baseUrl + path;
      console.log(`🧪 Testing path variation: ${fullUrl}`);
      
      try {
        const response = await axios.post(fullUrl, {
          test: true,
          sessionId: testSessionId,
          timestamp: new Date().toISOString()
        }, {
          headers,
          timeout: 10000,
          validateStatus: () => true
        });
        
        results[path] = {
          status: response.status,
          statusText: response.statusText,
          success: response.status < 400,
          responseData: response.data
        };
        
        console.log(`${response.status < 400 ? '✅' : '❌'} ${path}: ${response.status} ${response.statusText}`);
        
        if (response.status < 400) {
          console.log(`🎉 SUCCESS! Working path found: ${fullUrl}`);
          break; // Stop testing once we find a working path
        }
        
      } catch (error) {
        results[path] = {
          error: error.message,
          success: false
        };
        console.log(`❌ ${path}: ${error.message}`);
      }
    }
    
    const workingPaths = Object.entries(results).filter(([_, result]) => result.success);
    
    res.json({
      success: workingPaths.length > 0,
      sessionId: testSessionId,
      workingPaths: workingPaths.map(([path, result]) => ({
        path,
        fullUrl: baseUrl + path,
        status: result.status,
        statusText: result.statusText
      })),
      allResults: results,
      recommendations: workingPaths.length > 0 
        ? `Use this working path: ${baseUrl}${workingPaths[0][0]}`
        : 'No working paths found. Check your n8n webhook configuration.',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Path variations test failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Test recordings endpoint connectivity
 * POST /api/ai/test-recordings
 */
const testRecordingsEndpoint = async (req, res) => {
  try {
    const axios = require('axios');
    const config = require('../config/config');
    
    const { sessionId } = req.body;
    const testSessionId = sessionId || 'test-session-001';
    
    if (!config.ai.recordingsEndpointUrl) {
      return res.status(400).json({
        success: false,
        error: 'AI_RECORDINGS_ENDPOINT_URL not configured',
        timestamp: new Date().toISOString()
      });
    }
    
    // Replace the template variable with actual session ID
    // URL decode %7B%7B$json.sessionId%7D%7D to {{$json.sessionId}} and replace
    const endpointUrl = config.ai.recordingsEndpointUrl
      .replace(/%7B%7B\$json\.sessionId%7D%7D/g, testSessionId)
      .replace(/\{\{\$json\.sessionId\}\}/g, testSessionId);
    
    console.log('🧪 Testing recordings endpoint:', endpointUrl);
    console.log('📝 Original template URL:', config.ai.recordingsEndpointUrl);
    console.log('🔗 Resolved URL with sessionId:', endpointUrl);
    
    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'Legamunity-Test-Client/1.0'
    };
    
    // Add API key if configured
    if (config.ai.apiKey) {
      headers['Authorization'] = `Bearer ${config.ai.apiKey}`;
    }
    
    // Try different HTTP methods and request formats to test connectivity
    const testMethods = ['GET', 'POST', 'PUT'];
    const results = {};
    
    for (const method of testMethods) {
      try {
        console.log(`🔍 Testing ${method} request...`);
        
        const requestConfig = {
          method,
          url: endpointUrl,
          headers,
          timeout: 15000, // 15 second timeout for n8n
          validateStatus: () => true, // Accept any status code
          maxRedirects: 5 // Follow redirects
        };
        
        // Add different body formats for POST/PUT requests
        if (method === 'POST' || method === 'PUT') {
          // Test multiple payload formats that n8n might expect
          const payloads = [
            // Format 1: Simple test payload
            {
              test: true,
              sessionId: testSessionId,
              timestamp: new Date().toISOString(),
              message: 'Connectivity test from Legamunity backend'
            },
            // Format 2: n8n webhook format
            {
              sessionId: testSessionId,
              action: 'test',
              data: {
                test: true,
                timestamp: new Date().toISOString()
              }
            },
            // Format 3: Minimal format
            {
              sessionId: testSessionId
            }
          ];
          
          // Try the first payload format for now
          requestConfig.data = payloads[0];
        }
        
        const startTime = Date.now();
        const response = await axios(requestConfig);
        const responseTime = Date.now() - startTime;
        
        // Capture more detailed response information
        results[method] = {
          status: response.status,
          statusText: response.statusText,
          responseTime: `${responseTime}ms`,
          responseSize: JSON.stringify(response.data).length,
          responseData: response.data,
          responseHeaders: {
            'content-type': response.headers['content-type'],
            'server': response.headers['server'],
            'x-powered-by': response.headers['x-powered-by'],
            'access-control-allow-origin': response.headers['access-control-allow-origin']
          },
          success: response.status < 400,
          isRedirect: response.status >= 300 && response.status < 400
        };
        
        console.log(`✅ ${method} response: ${response.status} ${response.statusText} (${responseTime}ms)`);
        if (response.data && Object.keys(response.data).length > 0) {
          console.log(`📄 Response data:`, JSON.stringify(response.data, null, 2));
        }
        
      } catch (error) {
        results[method] = {
          error: error.message,
          code: error.code,
          success: false,
          details: {
            isTimeout: error.code === 'ECONNABORTED',
            isNetworkError: error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED',
            isSSLError: error.message.includes('certificate') || error.message.includes('SSL'),
            statusCode: error.response?.status,
            responseData: error.response?.data
          }
        };
        console.log(`❌ ${method} failed: ${error.message}`);
        if (error.response?.data) {
          console.log(`📄 Error response data:`, JSON.stringify(error.response.data, null, 2));
        }
      }
    }
    
    // Additional debugging: Test the base webhook path
    console.log('🔍 Testing base webhook path...');
    const baseWebhookUrl = 'https://adivs.app.n8n.cloud/webhook';
    try {
      const baseResponse = await axios.get(baseWebhookUrl, {
        timeout: 10000,
        validateStatus: () => true
      });
      results.baseWebhook = {
        status: baseResponse.status,
        statusText: baseResponse.statusText,
        success: baseResponse.status < 400
      };
      console.log(`✅ Base webhook response: ${baseResponse.status} ${baseResponse.statusText}`);
    } catch (error) {
      results.baseWebhook = {
        error: error.message,
        success: false
      };
      console.log(`❌ Base webhook failed: ${error.message}`);
    }
    
    // Determine overall connectivity
    const anySuccess = Object.values(results).some(r => r.success);
    const preferredMethods = results.POST?.success ? 'POST' : results.GET?.success ? 'GET' : null;
    
    res.json({
      success: anySuccess,
      endpoint: {
        template: config.ai.recordingsEndpointUrl,
        resolved: endpointUrl,
        sessionId: testSessionId
      },
      connectivity: {
        reachable: anySuccess,
        preferredMethod: preferredMethods,
        results: results
      },
      recommendations: {
        canConnect: anySuccess,
        suggestedMethod: preferredMethods || 'POST',
        notes: anySuccess 
          ? 'Endpoint is reachable and ready for integration'
          : 'Endpoint may be down, require authentication, or have CORS restrictions'
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Recordings endpoint test failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      operation: 'test_recordings_endpoint',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Update AI service configuration
 * POST /api/ai/config
 */
const updateConfig = async (req, res) => {
  try {
    const { endpointUrl, recordingsEndpointUrl, apiKey, mockMode, requestTimeout } = req.body;
    
    const newConfig = {};
    if (endpointUrl !== undefined) newConfig.endpointUrl = endpointUrl;
    if (recordingsEndpointUrl !== undefined) newConfig.recordingsEndpointUrl = recordingsEndpointUrl;
    if (apiKey !== undefined) newConfig.apiKey = apiKey;
    if (mockMode !== undefined) newConfig.mockMode = mockMode;
    if (requestTimeout !== undefined) newConfig.requestTimeout = requestTimeout;
    
    console.log('🔧 Updating AI service configuration:', newConfig);
    const updatedConfig = aiService.updateConfig(newConfig);
    
    res.json({
      success: true,
      message: 'AI service configuration updated',
      config: updatedConfig,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Config update failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

module.exports = {
  healthCheck,
  testTranscribe,
  testProcess,
  testGenerate,
  testWorkflow,
  testRecordingsEndpoint,
  testRecordingsVariations,
  testN8nPatterns,
  testDirectN8nUrl,
  testN8nTestUrl,
  updateConfig
};
