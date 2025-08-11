# AI Service Integration Guide

## Overview

The AI service has been refactored to support both **mock mode** (for development/testing) and **real endpoint mode** (for production with n8n). The service automatically switches between modes based on configuration.

## Configuration

### Environment Variables

Add these variables to your `.env` file:

```bash
# AI Service Configuration (n8n endpoint)
AI_ENDPOINT_URL=https://your-n8n-instance.com/webhook/ai-processing
AI_API_KEY=your_ai_api_key_here
AI_MOCK_MODE=true
AI_REQUEST_TIMEOUT=60000
AI_MAX_RETRIES=3
AI_RETRY_DELAY=2000
```

### Configuration Details

- **AI_ENDPOINT_URL**: The n8n webhook URL for AI processing
- **AI_API_KEY**: Optional API key for authentication
- **AI_MOCK_MODE**: Set to `false` to use real endpoint, `true` for mock mode
- **AI_REQUEST_TIMEOUT**: Request timeout in milliseconds (default: 60000)
- **AI_MAX_RETRIES**: Number of retry attempts on failure (default: 3)
- **AI_RETRY_DELAY**: Base delay between retries in milliseconds (default: 2000)

## Service Functions

### Core Functions

1. **transcribeAudio(audioFilePath)**
   - Transcribes audio files to text
   - Supports: mp3, wav, m4a, aac, ogg, webm, flac
   - Mock mode: Returns sample transcription
   - Real mode: Uploads file to n8n endpoint

2. **processText(textContent)**
   - Processes raw text content
   - Mock mode: Returns content unchanged
   - Real mode: Sends content to n8n for processing

3. **generateDraft(content, interviewMetadata)**
   - Generates life story draft from processed content
   - Mock mode: Returns structured mock draft
   - Real mode: Calls n8n endpoint for AI generation

4. **processInterviewFile(filePath, interviewData)**
   - Complete workflow: transcribe → process → generate draft
   - Handles both audio and text files
   - Returns comprehensive processing results

### Utility Functions

1. **healthCheck()**
   - Tests AI service connectivity
   - Returns service status and configuration

2. **getConfig()**
   - Returns current AI service configuration

3. **updateConfig(newConfig)**
   - Updates configuration at runtime (for testing)

## API Endpoints for Testing

The service includes test endpoints at `/api/ai/*`:

### Health Check
```http
GET /api/ai/health
```
Returns service health status and configuration.

### Individual Function Tests

```http
POST /api/ai/test-transcribe
Content-Type: application/json

{
  "mockFilePath": "test-audio.mp3"
}
```

```http
POST /api/ai/test-process
Content-Type: application/json

{
  "textContent": "Test text to process"
}
```

```http
POST /api/ai/test-generate
Content-Type: application/json

{
  "content": "Interview content",
  "interviewMetadata": {
    "id": "test-001",
    "name": "Test Interview",
    "type": "life_story"
  }
}
```

### Complete Workflow Test
```http
POST /api/ai/test-workflow
Content-Type: application/json

{
  "filePath": "test-interview.mp3",
  "interviewData": {
    "id": "workflow-test-001",
    "name": "Workflow Test"
  }
}
```

### Configuration Update
```http
POST /api/ai/config
Content-Type: application/json

{
  "endpointUrl": "https://new-n8n-endpoint.com/webhook/ai",
  "mockMode": false,
  "requestTimeout": 90000
}
```

## n8n Endpoint Integration

### Expected Request Format

The service sends requests to your n8n endpoint in this format:

#### For Text Processing
```json
{
  "operation": "process",
  "content": "text content to process",
  "contentType": "text",
  "timestamp": "2025-01-11T12:00:00.000Z"
}
```

#### For Audio Transcription
```
POST /your-n8n-endpoint
Content-Type: multipart/form-data

file: [audio file]
operation: transcribe
metadata: {"fileType": "audio", "language": "auto-detect"}
timestamp: 2025-01-11T12:00:00.000Z
```

#### For Draft Generation
```json
{
  "operation": "generate",
  "content": "processed interview content",
  "interviewMetadata": {
    "id": "interview-001",
    "name": "Interview Name",
    "type": "life_story"
  },
  "operation": "generate_life_story_draft",
  "language": "auto-detect",
  "style": "narrative",
  "length": "medium",
  "timestamp": "2025-01-11T12:00:00.000Z"
}
```

### Expected Response Format

Your n8n endpoint should return responses in this format:

#### Transcription Response
```json
{
  "transcription": "transcribed text content",
  "confidence": 0.95,
  "language": "en",
  "duration": 120
}
```

#### Text Processing Response
```json
{
  "processedContent": "processed text content",
  "metadata": {
    "wordCount": 150,
    "language": "en"
  }
}
```

#### Draft Generation Response
```json
{
  "title": "Life Story Draft Title",
  "summary": "Brief summary of the life story",
  "sections": {
    "introduction": "Introduction text",
    "earlyLife": "Early life section",
    "careerJourney": "Career section",
    "personalRelationships": "Relationships section",
    "lifeWisdom": "Wisdom section",
    "conclusion": "Conclusion text"
  },
  "keyThemes": ["Family", "Career", "Growth"],
  "wordCount": 2500,
  "estimatedReadingTime": "10 minutes",
  "model": "gpt-4",
  "confidence": 0.92
}
```

## Authentication

The service supports multiple authentication methods:

1. **Bearer Token**: `Authorization: Bearer YOUR_API_KEY`
2. **API Key Header**: `X-API-Key: YOUR_API_KEY`
3. **n8n API Key**: `n8n-api-key: YOUR_API_KEY`

Configure the method your n8n endpoint expects by setting the `AI_API_KEY` environment variable.

## Error Handling

The service includes comprehensive error handling:

- **Automatic Retries**: Failed requests are retried with exponential backoff
- **Timeout Protection**: Requests timeout after configured duration
- **Graceful Fallback**: Falls back to mock mode if endpoint is unavailable
- **Detailed Logging**: All operations are logged with timestamps and status

## Testing the Integration

1. **Start in Mock Mode**: Set `AI_MOCK_MODE=true` to test without real endpoint
2. **Test Health Check**: `GET /api/ai/health` to verify configuration
3. **Test Individual Functions**: Use test endpoints to verify each function
4. **Configure Real Endpoint**: Update environment variables with n8n URL
5. **Switch to Real Mode**: Set `AI_MOCK_MODE=false`
6. **Test Complete Workflow**: Use `/api/ai/test-workflow` to test end-to-end

## Integration Checklist

- [ ] Add AI configuration to `.env` file
- [ ] Set up n8n webhook endpoint
- [ ] Configure authentication (if required)
- [ ] Test health check endpoint
- [ ] Test individual AI functions
- [ ] Test complete workflow
- [ ] Switch from mock to real mode
- [ ] Monitor logs for any issues

## Current Status

✅ **AI Service Refactored**: Supports both mock and real modes
✅ **Configuration Added**: Environment variables and runtime config
✅ **Test Endpoints Created**: Full test suite available
✅ **Error Handling**: Retry logic and graceful fallbacks
✅ **Documentation**: Complete integration guide
🔄 **Waiting for n8n Endpoint**: Ready to integrate once URL is provided

The AI service is now fully prepared for n8n integration. Simply provide the endpoint URL and the service will automatically switch to real mode!
