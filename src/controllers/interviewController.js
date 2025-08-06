const { v4: uuidv4 } = require('uuid');

// Mock data for interviews - will be replaced with Supabase later
const mockInterviews = [
  {
    id: 'interview_001',
    sessionId: 'session_001',
    type: 'technical',
    interviewer: {
      id: 'friend_001',
      name: 'Sarah Wilson',
      email: 'sarah.wilson@example.com'
    },
    scheduledAt: '2024-01-15T10:00:00Z',
    startedAt: '2024-01-15T10:05:00Z',
    completedAt: '2024-01-15T11:05:00Z',
    duration: 60,
    status: 'completed',
    location: 'online',
    notes: 'Strong technical skills, good problem-solving approach',
    isFriendInterview: false,
    content: {
      questions: [
        {
          id: 'q1',
          question: 'Explain the difference between let, const, and var in JavaScript',
          answer: 'Detailed explanation about scope and hoisting...',
          timestamp: '2024-01-15T10:15:00Z'
        }
      ],
      summary: 'Candidate showed strong technical understanding',
      rating: 4.5,
      strengths: ['Problem solving', 'Code quality'],
      improvements: ['System design knowledge']
    },
    createdAt: '2024-01-15T09:00:00Z',
    updatedAt: '2024-01-15T11:05:00Z'
  }
];

// Import draft service for auto-creation
const draftService = require('../services/draftService');

/**
 * @desc    Get all interviews
 * @route   GET /api/interviews
 * @access  Admin
 */
const getAllInterviews = async (req, res) => {
  try {
    const { sessionId, status, type, page = 1, limit = 10 } = req.query;
    
    let filteredInterviews = [...mockInterviews];
    
    // Apply filters
    if (sessionId) {
      filteredInterviews = filteredInterviews.filter(interview => 
        interview.sessionId === sessionId
      );
    }
    
    if (status) {
      filteredInterviews = filteredInterviews.filter(interview => 
        interview.status === status
      );
    }
    
    if (type) {
      filteredInterviews = filteredInterviews.filter(interview => 
        interview.type === type
      );
    }
    
    // Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const paginatedInterviews = filteredInterviews.slice(startIndex, endIndex);
    
    res.json({
      success: true,
      data: paginatedInterviews,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: filteredInterviews.length,
        pages: Math.ceil(filteredInterviews.length / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching interviews:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching interviews'
    });
  }
};

/**
 * @desc    Get interview by ID
 * @route   GET /api/interviews/:id
 * @access  Admin
 */
const getInterviewById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const interview = mockInterviews.find(interview => interview.id === id);
    
    if (!interview) {
      return res.status(404).json({
        success: false,
        message: 'Interview not found'
      });
    }
    
    res.json({
      success: true,
      data: interview
    });
  } catch (error) {
    console.error('Error fetching interview:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching interview'
    });
  }
};

/**
 * @desc    Start an interview
 * @route   POST /api/interviews/:id/start
 * @access  Admin
 */
const startInterview = async (req, res) => {
  try {
    const { id } = req.params;
    
    const interviewIndex = mockInterviews.findIndex(interview => interview.id === id);
    
    if (interviewIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Interview not found'
      });
    }
    
    // Update interview status to in-progress
    mockInterviews[interviewIndex] = {
      ...mockInterviews[interviewIndex],
      status: 'in-progress',
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    res.json({
      success: true,
      data: mockInterviews[interviewIndex],
      message: 'Interview started successfully'
    });
  } catch (error) {
    console.error('Error starting interview:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while starting interview'
    });
  }
};

/**
 * @desc    Complete an interview (triggers auto-draft creation)
 * @route   POST /api/interviews/:id/complete
 * @access  Admin
 */
const completeInterview = async (req, res) => {
  try {
    const { id } = req.params;
    const { content, notes, rating } = req.body;
    
    const interviewIndex = mockInterviews.findIndex(interview => interview.id === id);
    
    if (interviewIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Interview not found'
      });
    }
    
    // Update interview with completion data
    const completedInterview = {
      ...mockInterviews[interviewIndex],
      status: 'completed',
      completedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      content: content || mockInterviews[interviewIndex].content,
      notes: notes || mockInterviews[interviewIndex].notes,
      rating: rating || mockInterviews[interviewIndex].rating
    };
    
    mockInterviews[interviewIndex] = completedInterview;
    
    // **KEY FEATURE: Auto-trigger draft creation/update**
    try {
      const draftResult = await draftService.handleInterviewCompletion(completedInterview);
      
      res.json({
        success: true,
        data: completedInterview,
        draft: draftResult,
        message: 'Interview completed successfully and draft updated'
      });
    } catch (draftError) {
      console.error('Error creating/updating draft:', draftError);
      
      // Still return success for interview completion, but note draft issue
      res.json({
        success: true,
        data: completedInterview,
        message: 'Interview completed successfully, but draft update failed',
        draftError: draftError.message
      });
    }
  } catch (error) {
    console.error('Error completing interview:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while completing interview'
    });
  }
};

/**
 * @desc    Update interview content during session
 * @route   PUT /api/interviews/:id/content
 * @access  Admin
 */
const updateInterviewContent = async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    
    const interviewIndex = mockInterviews.findIndex(interview => interview.id === id);
    
    if (interviewIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Interview not found'
      });
    }
    
    // Update interview content
    mockInterviews[interviewIndex] = {
      ...mockInterviews[interviewIndex],
      content: {
        ...mockInterviews[interviewIndex].content,
        ...content
      },
      updatedAt: new Date().toISOString()
    };
    
    res.json({
      success: true,
      data: mockInterviews[interviewIndex],
      message: 'Interview content updated successfully'
    });
  } catch (error) {
    console.error('Error updating interview content:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating interview content'
    });
  }
};

/**
 * @desc    Update interview details (name, notes, etc.)
 * @route   PUT /api/interviews/:id
 * @access  Admin
 */
const updateInterview = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    // Import shared mock data
    const { mockSessions } = require('../data/mockData');
    
    // Find interview in sessions first (most common case)
    let foundInterview = null;
    let foundSession = null;
    let interviewIndex = -1;
    
    for (const session of mockSessions) {
      if (session.interviews) {
        interviewIndex = session.interviews.findIndex(interview => interview.id === id);
        if (interviewIndex !== -1) {
          foundInterview = session.interviews[interviewIndex];
          foundSession = session;
          break;
        }
      }
    }
    
    // If not found in sessions, check standalone mockInterviews
    if (!foundInterview) {
      interviewIndex = mockInterviews.findIndex(interview => interview.id === id);
      if (interviewIndex !== -1) {
        foundInterview = mockInterviews[interviewIndex];
      }
    }
    
    if (!foundInterview) {
      return res.status(404).json({
        success: false,
        message: 'Interview not found'
      });
    }
    
    // Update interview with new data
    const updatedInterview = {
      ...foundInterview,
      ...updateData,
      updatedAt: new Date().toISOString()
    };
    
    // Update the interview in the appropriate location
    if (foundSession) {
      foundSession.interviews[interviewIndex] = updatedInterview;
      foundSession.updatedAt = new Date().toISOString();
    } else {
      mockInterviews[interviewIndex] = updatedInterview;
    }
    
    console.log('✏️ Interview updated:', {
      interviewId: id,
      updatedFields: Object.keys(updateData),
      newName: updateData.name || 'unchanged',
      location: foundSession ? 'session' : 'standalone'
    });
    
    res.json({
      success: true,
      data: updatedInterview,
      message: 'Interview updated successfully'
    });
    
  } catch (error) {
    console.error('Error updating interview:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating interview',
      error: error.message
    });
  }
};

/**
 * @desc    Add new interview to a session
 * @route   POST /api/sessions/:sessionId/interviews
 * @access  Admin
 */
const addInterviewToSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { name, type = 'life_story', duration = 90, status = 'pending' } = req.body;
    
    // Generate new interview ID
    const interviewId = `interview_${sessionId}_${Date.now()}`;
    
    // Create new interview object
    const newInterview = {
      id: interviewId,
      sessionId,
      name: name || `new interview ${Date.now()}`,
      type,
      status,
      duration,
      file_upload: null,
      notes: '',
      isFriendInterview: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // Add to mock interviews array
    mockInterviews.push(newInterview);
    
    console.log('➕ New interview added:', {
      interviewId: newInterview.id,
      sessionId,
      name: newInterview.name,
      type: newInterview.type
    });
    
    res.status(201).json({
      success: true,
      data: newInterview,
      message: 'Interview added successfully'
    });
  } catch (error) {
    console.error('Error adding interview:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while adding interview'
    });
  }
};

/**
 * @desc    Upload file for interview and process with AI
 * @route   POST /api/interviews/:interviewId/upload
 * @access  Admin
 */
const uploadInterviewFile = async (req, res) => {
  try {
    const { interviewId } = req.params;
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }
    
    // Import shared mock data and AI service
    const { mockSessions } = require('../data/mockData');
    const aiService = require('../services/aiService');
    
    // Find interview in sessions
    let foundInterview = null;
    let foundSession = null;
    let interviewIndex = -1;
    
    for (const session of mockSessions) {
      if (session.interviews) {
        interviewIndex = session.interviews.findIndex(interview => interview.id === interviewId);
        if (interviewIndex !== -1) {
          foundInterview = session.interviews[interviewIndex];
          foundSession = session;
          break;
        }
      }
    }
    
    // If not found in sessions, check standalone mockInterviews
    if (!foundInterview) {
      interviewIndex = mockInterviews.findIndex(interview => interview.id === interviewId);
      if (interviewIndex !== -1) {
        foundInterview = mockInterviews[interviewIndex];
      }
    }
    
    if (!foundInterview) {
      return res.status(404).json({
        success: false,
        message: 'Interview not found'
      });
    }
    
    console.log('📁 File uploaded for interview:', {
      interviewId,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      filePath: req.file.path
    });
    
    // Update interview with file information
    const updatedInterview = {
      ...foundInterview,
      file_upload: {
        fileName: req.file.filename,
        originalName: req.file.originalname,
        filePath: req.file.path,
        fileSize: req.file.size,
        uploadedAt: new Date().toISOString()
      },
      updatedAt: new Date().toISOString()
    };
    
    console.log('📁 File uploaded for interview:', {
      interviewId,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      filePath: req.file.path
    });
    
    // Process AI synchronously
    console.log('🤖 Starting synchronous AI processing for interview:', interviewId);
    updatedInterview.status = 'processing';
    
    try {
      // Run AI processing synchronously
      const aiResult = await aiService.processInterviewFile(req.file.path, updatedInterview);
      
      // Update interview with AI results
      updatedInterview.status = 'completed';
      updatedInterview.transcription = aiResult.transcription;
      updatedInterview.aiDraft = aiResult.draft;
      updatedInterview.processedAt = new Date().toISOString();
      updatedInterview.updatedAt = new Date().toISOString();
      
      console.log('✅ AI processing completed synchronously for interview:', interviewId);
      
    } catch (aiError) {
      console.error('❌ AI processing failed for interview:', interviewId, aiError);
      updatedInterview.status = 'failed';
      updatedInterview.error = aiError.message;
    }
    
    // Update interview in the appropriate location with final status
    if (foundSession) {
      foundSession.interviews[interviewIndex] = updatedInterview;
      foundSession.updatedAt = new Date().toISOString();
    } else {
      mockInterviews[interviewIndex] = updatedInterview;
    }
    
    res.json({
      success: true,
      message: `File uploaded and processed successfully. Interview status: ${updatedInterview.status}`,
      data: {
        interview: updatedInterview,
        file: {
          fileName: req.file.filename,
          originalName: req.file.originalname,
          size: req.file.size
        }
      }
    });
    
  } catch (error) {
    console.error('Error uploading interview file:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while uploading file',
      error: error.message
    });
  }
};

// Note: Background processing function removed - now processing synchronously in uploadInterviewFile

module.exports = {
  getAllInterviews,
  getInterviewById,
  startInterview,
  completeInterview,
  updateInterview,
  updateInterviewContent,
  addInterviewToSession,
  uploadInterviewFile
};
