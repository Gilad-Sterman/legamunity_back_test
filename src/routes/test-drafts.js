const express = require('express');
const router = express.Router();
// const draftService = require('../services/draftService');

/**
 * @route POST /api/test-drafts/simulate-completion
 * @desc Simulate interview completion for testing draft system
 * @access Admin
 */
router.post('/simulate-completion', async (req, res) => {
  try {
    const { sessionId = 'session_001', interviewId = 'interview_001' } = req.body;
    
    // Simulate a completed interview
    const mockCompletedInterview = {
      id: interviewId,
      sessionId: sessionId,
      type: 'technical',
      status: 'completed',
      interviewer: {
        id: 'interviewer_001',
        name: 'Sarah Wilson',
        email: 'sarah.wilson@example.com'
      },
      scheduledAt: '2025-01-25T10:00:00Z',
      startedAt: '2025-01-25T10:05:00Z',
      completedAt: new Date().toISOString(),
      duration: 60,
      location: 'online',
      notes: 'Excellent technical performance during simulation',
      isFriendInterview: false,
      content: {
        questions: [
          {
            id: 'q1',
            question: 'Explain React hooks and their benefits',
            answer: 'Hooks allow functional components to use state and lifecycle methods...',
            timestamp: '2025-01-25T10:15:00Z'
          },
          {
            id: 'q2',
            question: 'Design a scalable API architecture',
            answer: 'I would use microservices with proper caching and load balancing...',
            timestamp: '2025-01-25T10:35:00Z'
          }
        ],
        summary: 'Outstanding technical knowledge and problem-solving skills',
        rating: 4.7,
        strengths: ['React expertise', 'System design', 'Clean architecture', 'Problem solving'],
        improvements: ['Database optimization', 'DevOps knowledge'],
        skills: ['JavaScript', 'React', 'Node.js', 'System Design', 'API Development']
      },
      createdAt: '2025-01-25T09:00:00Z',
      updatedAt: new Date().toISOString()
    };
    
    // Test the draft service
    const result = await draftService.handleInterviewCompletion(mockCompletedInterview);
    
    res.json({
      success: true,
      message: 'Draft system simulation completed',
      interview: mockCompletedInterview,
      draftResult: result,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error in draft simulation:', error);
    res.status(500).json({
      success: false,
      message: 'Error simulating draft creation',
      error: error.message
    });
  }
});

/**
 * @route POST /api/test-drafts/simulate-multiple
 * @desc Simulate multiple interview completions for version testing
 * @access Admin
 */
router.post('/simulate-multiple', async (req, res) => {
  try {
    const { sessionId = 'session_001' } = req.body;
    const results = [];
    
    // Simulate completing multiple interviews in sequence
    const interviews = [
      {
        id: 'interview_001',
        type: 'technical',
        rating: 4.5,
        summary: 'Strong technical foundation',
        strengths: ['JavaScript', 'React', 'Problem solving'],
        skills: ['JavaScript', 'React', 'Node.js']
      },
      {
        id: 'interview_002', 
        type: 'behavioral',
        rating: 4.2,
        summary: 'Great communication and leadership potential',
        strengths: ['Communication', 'Leadership', 'Team collaboration'],
        achievements: ['Led team of 4', 'Improved deployment process']
      }
    ];
    
    for (const interviewData of interviews) {
      const mockInterview = {
        id: interviewData.id,
        sessionId: sessionId,
        type: interviewData.type,
        status: 'completed',
        interviewer: { name: 'Test Interviewer', id: 'test_001' },
        completedAt: new Date().toISOString(),
        content: {
          rating: interviewData.rating,
          summary: interviewData.summary,
          strengths: interviewData.strengths,
          skills: interviewData.skills,
          achievements: interviewData.achievements
        }
      };
      
      const result = await draftService.handleInterviewCompletion(mockInterview);
      results.push({
        interview: interviewData.id,
        result: result
      });
      
      // Small delay between interviews
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    res.json({
      success: true,
      message: 'Multiple interview simulation completed',
      results: results,
      summary: {
        totalInterviews: interviews.length,
        versionsCreated: results.filter(r => r.result.action === 'created' || r.result.action === 'updated').length
      }
    });
    
  } catch (error) {
    console.error('Error in multiple interview simulation:', error);
    res.status(500).json({
      success: false,
      message: 'Error simulating multiple interviews',
      error: error.message
    });
  }
});

/**
 * @route POST /api/test-drafts/test-stage-transition
 * @desc Test manual stage transitions with validation
 * @access Admin
 */
router.post('/test-stage-transition', async (req, res) => {
  try {
    const { 
      draftId = 'draft-001', 
      targetStage, 
      adminUser = {
        id: 'admin-001',
        name: 'Test Admin',
        email: 'admin@test.com',
        role: 'admin'
      },
      reason,
      rejectionReason
    } = req.body;
    
    if (!targetStage) {
      return res.status(400).json({
        success: false,
        message: 'targetStage is required'
      });
    }
    
    // Test the manual stage transition
    const result = await draftService.transitionDraftStage(draftId, targetStage, {
      adminUser,
      reason,
      rejectionReason
    });
    
    res.json({
      success: result.success,
      message: result.message,
      data: result,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error testing stage transition:', error);
    res.status(500).json({
      success: false,
      message: 'Error testing stage transition',
      error: error.message
    });
  }
});

/**
 * @route GET /api/test-drafts/test-stage-validation
 * @desc Test stage validation rules
 * @access Admin
 */
router.get('/test-stage-validation', async (req, res) => {
  try {
    const stageValidationService = require('../services/stageValidationService');
    
    const testCases = [
      {
        name: 'Valid progression: first_draft → in_progress',
        from: 'first_draft',
        to: 'in_progress',
        context: { isAdminAction: false, automaticTrigger: true }
      },
      {
        name: 'Invalid progression: first_draft → approved',
        from: 'first_draft',
        to: 'approved',
        context: { isAdminAction: true }
      },
      {
        name: 'Admin approval: pending_review → approved',
        from: 'pending_review',
        to: 'approved',
        context: {
          isAdminAction: true,
          adminUser: { id: 'admin-001', name: 'Test Admin' },
          draftData: { interviewCount: 3, content: { recommendations: { overallRating: '4.5' } } },
          sessionData: { interviews: [1, 2, 3] }
        }
      },
      {
        name: 'Rejection without reason',
        from: 'under_review',
        to: 'rejected',
        context: {
          isAdminAction: true,
          adminUser: { id: 'admin-001' },
          rejectionReason: 'Bad'
        }
      },
      {
        name: 'Valid rejection with reason',
        from: 'under_review',
        to: 'rejected',
        context: {
          isAdminAction: true,
          adminUser: { id: 'admin-001' },
          rejectionReason: 'Insufficient technical depth in responses, needs more detailed examples'
        }
      }
    ];
    
    const results = testCases.map(testCase => {
      const validation = stageValidationService.validateTransition(
        testCase.from,
        testCase.to,
        testCase.context
      );
      
      return {
        testCase: testCase.name,
        from: testCase.from,
        to: testCase.to,
        valid: validation.valid,
        reason: validation.reason || validation.message,
        requiresAdmin: validation.requiresAdmin,
        context: testCase.context
      };
    });
    
    res.json({
      success: true,
      message: 'Stage validation test completed',
      results: results,
      summary: {
        total: results.length,
        passed: results.filter(r => r.valid).length,
        failed: results.filter(r => !r.valid).length
      }
    });
    
  } catch (error) {
    console.error('Error testing stage validation:', error);
    res.status(500).json({
      success: false,
      message: 'Error testing stage validation',
      error: error.message
    });
  }
});

/**
 * @route GET /api/test-drafts/test-history/:draftId
 * @desc Test draft history retrieval with filters
 * @access Admin
 */
router.get('/test-history/:draftId', async (req, res) => {
  try {
    const { draftId } = req.params;
    const { action, triggeredBy, fromDate, toDate } = req.query;
    
    const filters = {};
    if (action) filters.action = action;
    if (triggeredBy) filters.triggeredBy = triggeredBy;
    if (fromDate) filters.fromDate = fromDate;
    if (toDate) filters.toDate = toDate;
    
    const historyResult = await draftService.getDraftHistory(draftId, filters);
    
    res.json({
      success: historyResult.success,
      message: 'Draft history retrieved successfully',
      data: historyResult,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error testing history retrieval:', error);
    res.status(500).json({
      success: false,
      message: 'Error testing history retrieval',
      error: error.message
    });
  }
});

/**
 * @route GET /api/test-drafts/stage-metadata/:stage
 * @desc Get metadata for a specific stage
 * @access Admin
 */
router.get('/stage-metadata/:stage', async (req, res) => {
  try {
    const { stage } = req.params;
    const stageValidationService = require('../services/stageValidationService');
    
    const metadata = stageValidationService.getStageMetadata(stage);
    const availableTransitions = stageValidationService.getAvailableTransitions(stage, {
      draftData: { interviewCount: 2 },
      sessionData: { interviews: [1, 2, 3] }
    });
    
    res.json({
      success: true,
      stage: stage,
      metadata: metadata,
      availableTransitions: availableTransitions,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error getting stage metadata:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting stage metadata',
      error: error.message
    });
  }
});

module.exports = router;
