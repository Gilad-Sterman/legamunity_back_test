const supabaseService = require('../services/supabaseService');
const loggingService = require('../services/loggingService');

/**
 * Supabase Sessions Controller
 * Handles all session-related operations using Supabase database
 */

// @desc    Get all sessions with optional filtering and pagination
// @route   GET /api/admin/sessions
// @access  Admin
const getAllSessions = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      priority_level,
      session_type,
      preferred_language,
      search,
      sort_by = 'created_at',
      sort_order = 'desc'
    } = req.query;

    // Build filters object
    const filters = {};
    if (status) filters.status = status;
    if (priority_level) filters.priority_level = priority_level;
    if (session_type) filters.session_type = session_type;
    if (preferred_language) filters.preferred_language = preferred_language;

    // Get sessions from Supabase
    const result = await supabaseService.getSessions({
      page: parseInt(page),
      limit: parseInt(limit),
      filters,
      search,
      sortBy: sort_by,
      sortOrder: sort_order
    });

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch sessions',
        error: result.error
      });
    }

    res.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
      message: `Retrieved ${result.data.length} sessions`
    });

  } catch (error) {
    console.error('Error in getAllSessions:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching sessions',
      error: error.message
    });
  }
};

// @desc    Get session by ID
// @route   GET /api/admin/sessions/:id
// @access  Admin
const getSessionById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await supabaseService.getSessionById(id);

    if (!result.success) {
      if (result.error === 'Session not found') {
        return res.status(404).json({
          success: false,
          message: 'Session not found'
        });
      }
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch session',
        error: result.error
      });
    }

    res.json({
      success: true,
      data: result.data,
      message: 'Session retrieved successfully'
    });

  } catch (error) {
    console.error('Error in getSessionById:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching session',
      error: error.message
    });
  }
};

// @desc    Create a new session
// @route   POST /api/admin/sessions
// @access  Admin
const createSession = async (req, res) => {
  try {
    const sessionData = req.body;

    // Validate required fields
    const requiredFields = ['client_name', 'client_age', 'session_type', 'preferred_language'];
    const missingFields = requiredFields.filter(field => !sessionData[field]);

    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields',
        missingFields
      });
    }

    // Add metadata
    sessionData.created_by = req.user.uid;
    sessionData.status = sessionData.status || 'pending';
    sessionData.priority_level = sessionData.priority_level || 'standard';

    const result = await supabaseService.createSession(sessionData);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to create session',
        error: result.error
      });
    }

    // Log session creation
    try {
      console.log('Attempting to log session creation:', {
        sessionId: result.data.id,
        userId: req.user?.id,
        userEmail: req.user?.email,
        clientName: sessionData.client_name
      });
      await req.logSessionCreated(result.data.id, sessionData);
      console.log('Session creation logged successfully');
    } catch (logError) {
      console.error('Failed to log session creation:', logError);
    }

    res.status(201).json({
      success: true,
      data: result.data,
      message: 'Session created successfully'
    });

  } catch (error) {
    console.error('Error in createSession:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating session',
      error: error.message
    });
  }
};

// @desc    Update session
// @route   PUT /api/admin/sessions/:id
// @access  Admin
const updateSession = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Add metadata
    updateData.updated_by = req.user.uid;

    const result = await supabaseService.updateSession(id, updateData);

    if (!result.success) {
      if (result.error === 'Session not found') {
        return res.status(404).json({
          success: false,
          message: 'Session not found'
        });
      }
      return res.status(500).json({
        success: false,
        message: 'Failed to update session',
        error: result.error
      });
    }

    // Log session update
    await req.logSessionUpdated(sessionId, sessionData);

    res.json({
      success: true,
      data: result.data,
      message: 'Session updated successfully'
    });

  } catch (error) {
    console.error('Error in updateSession:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating session',
      error: error.message
    });
  }
};

// @desc    Update session scheduling
// @route   PUT /api/admin/sessions/:id/scheduling
// @access  Admin
const updateSessionScheduling = async (req, res) => {
  try {
    const { id } = req.params;
    const { scheduling_details } = req.body;

    if (!scheduling_details) {
      return res.status(400).json({
        success: false,
        message: 'Scheduling details are required'
      });
    }

    // First get the current session to preserve existing preferences
    const sessionResult = await supabaseService.getSessionById(id);
    if (!sessionResult.success) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    // Update the preferences with new scheduling details

    const updatedPreferences = {
      ...sessionResult.data.preferences,
      interviews: sessionResult.data.preferences?.interviews.map(interview => ({
        ...interview,
        duration: interview.status === 'completed' ? interview.duration : scheduling_details.duration,
        status: interview.status === 'pending' ? 'scheduled' : interview.status
      })),
      interview_scheduling: {
        ...sessionResult.data.preferences?.interview_scheduling,
        ...scheduling_details,
        enabled: true
      }
    };

    const updateData = {
      preferences: updatedPreferences
    };

    const result = await supabaseService.updateSession(id, updateData);

    if (!result.success) {
      if (result.error === 'Session not found') {
        return res.status(404).json({
          success: false,
          message: 'Session not found'
        });
      }
      return res.status(500).json({
        success: false,
        message: 'Failed to update session scheduling',
        error: result.error
      });
    }

    res.json({
      success: true,
      data: result.data,
      message: 'Session scheduling updated successfully'
    });

  } catch (error) {
    console.error('Error in updateSessionScheduling:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating session scheduling',
      error: error.message
    });
  }
};

// @desc    Add interview to session
// @route   POST /api/admin/sessions/:id/interviews
// @access  Admin
const addInterviewToSession = async (req, res) => {
  try {
    const { id: sessionId } = req.params;
    const interviewData = req.body;
    console.log('interviewData', interviewData);
    // Validate required fields - interviews can be created with minimal data
    // The frontend sends: name, type, duration, status
    // We'll set reasonable defaults for missing fields
    if (!interviewData.type) {
      interviewData.type = 'life_story';
    }
    if (!interviewData.status) {
      interviewData.status = 'pending';
    }
    if (!interviewData.duration) {
      interviewData.duration = 90;
    }

    // Add metadata
    interviewData.session_id = sessionId;
    interviewData.created_by = req.user.uid;
    interviewData.status = interviewData.status || 'scheduled';

    const result = await supabaseService.addInterviewToSession(sessionId, interviewData);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to add interview to session',
        error: result.error
      });
    }

    // Log interview creation
    try {
      console.log('Attempting to log interview creation:', {
        sessionId,
        interviewId: interviewData.id,
        userId: req.user?.id,
        userEmail: req.user?.email
      });
      await req.logInterviewCreated(sessionId, interviewData.id, interviewData);
      console.log('Interview creation logged successfully');
    } catch (logError) {
      console.error('Failed to log interview creation:', logError);
    }

    res.status(201).json({
      success: true,
      data: result.data,
      message: 'Interview added to session successfully'
    });

  } catch (error) {
    console.error('Error in addInterviewToSession:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while adding interview to session',
      error: error.message
    });
  }
};

// @desc    Delete session
// @route   DELETE /api/admin/sessions/:id
// @access  Admin
const deleteSession = async (req, res) => {
  try {
    const { id } = req.params;

    // Get session data before deletion for logging
    const sessionResult = await supabaseService.getSessionById(id);
    const sessionData = sessionResult.success ? sessionResult.data : null;

    const result = await supabaseService.deleteSession(id);

    if (!result.success) {
      if (result.error === 'Session not found') {
        return res.status(404).json({
          success: false,
          message: 'Session not found'
        });
      }
      return res.status(500).json({
        success: false,
        message: 'Failed to delete session',
        error: result.error
      });
    }

    // Log session deletion
    if (sessionData) {
      await req.logSessionDeleted(id, sessionData);
    }

    res.json({
      success: true,
      message: 'Session deleted successfully'
    });

  } catch (error) {
    console.error('Error in deleteSession:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting session',
      error: error.message
    });
  }
};

// @desc    Get session statistics
// @route   GET /api/admin/sessions/stats
// @access  Admin
const getSessionStats = async (req, res) => {
  try {
    const result = await supabaseService.getSessionStats();

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch session statistics',
        error: result.error
      });
    }

    res.json({
      success: true,
      data: result.data,
      message: 'Session statistics retrieved successfully'
    });

  } catch (error) {
    console.error('Error in getSessionStats:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching session statistics',
      error: error.message
    });
  }
};

// @desc    Update interview within a session
// @route   PUT /api/admin/interviews/:id
// @access  Admin
const updateInterview = async (req, res) => {
  try {
    const { id: interviewId } = req.params;
    const updateData = req.body;

    // We need to find which session contains this interview
    // Since interviews are stored in session preferences, we need to search through sessions
    const sessionsResult = await supabaseService.getSessions();

    if (!sessionsResult.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch sessions to find interview',
        error: sessionsResult.error
      });
    }

    // Find the session that contains this interview
    let targetSessionId = null;
    for (const session of sessionsResult.data) {
      const interviews = session.preferences?.interviews || [];
      if (interviews.some(interview => interview.id === interviewId)) {
        targetSessionId = session.id;
        break;
      }
    }

    if (!targetSessionId) {
      return res.status(404).json({
        success: false,
        message: 'Interview not found'
      });
    }

    // Update the interview
    const result = await supabaseService.updateInterviewInSession(targetSessionId, interviewId, updateData);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to update interview',
        error: result.error
      });
    }

    res.json({
      success: true,
      data: result.data,
      message: 'Interview updated successfully'
    });

  } catch (error) {
    console.error('Error in updateInterview:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating interview',
      error: error.message
    });
  }
};

// @desc    Upload file for interview with AI processing
// @route   POST /api/admin/sessions/interviews/:id/upload
// @access  Admin
const uploadInterviewFile = async (req, res) => {
  try {
    const { id: interviewId } = req.params;
    const file = req.file; // Assuming multer middleware for file handling

    if (!file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    // Import AI service
    const aiService = require('../services/aiService');

    // Simulate file upload (in real implementation, this would upload to Supabase Storage)
    const fileMetadata = {
      originalName: file.originalname,
      fileName: `interview_${interviewId}_${Date.now()}_${file.originalname}`,
      fileSize: file.size,
      mimeType: file.mimetype,
      uploadedAt: new Date().toISOString(),
      uploadedBy: req.user.uid,
      storageUrl: `https://mock-storage.supabase.co/storage/v1/object/interviews/${interviewId}/${file.originalname}` // Mock URL
    };

    // Determine file type
    const audioTypes = ['audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/aac', 'audio/ogg', 'audio/webm', 'audio/flac'];
    const isAudioFile = audioTypes.includes(file.mimetype);

    let transcription = null;
    let processedContent = null;

    // Step 1: Process file based on type
    if (isAudioFile) {
      console.log('🎵 Processing audio file for transcription...');
      // For audio files, we simulate using the file path (in real implementation, this would be the actual file path)
      const mockFilePath = `uploads/interviews/${interviewId}/${file.originalname}`;
      transcription = await aiService.transcribeAudio(mockFilePath);
      processedContent = transcription;
    } else {
      console.log('📄 Processing text file...');
      // For text files, simulate reading content
      const textContent = file.buffer.toString('utf8');
      processedContent = await aiService.processText(textContent);
    }

    // Step 2: Generate AI draft from processed content
    console.log('🤖 Generating AI draft from processed content...');
    const interviewMetadata = {
      id: interviewId,
      name: `Interview ${interviewId}`,
      type: isAudioFile ? 'audio_interview' : 'text_interview',
      fileType: file.mimetype,
      // TODO: Get duration from file
      duration: isAudioFile ? _getFileDuration(file) : '',
      // TODO: Get word count from file
      wordCount: _getFileWordCount(transcription),
    };

    const generatedDraft = await aiService.generateDraft(processedContent, interviewMetadata);

    // Step 3: Find and update the interview
    const sessionsResult = await supabaseService.getSessions();
    if (!sessionsResult.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch sessions to find interview'
      });
    }

    // Find the session that contains this interview
    let targetSessionId = null;
    let targetInterview = null;

    for (const session of sessionsResult.data) {
      const interviews = session.preferences?.interviews || [];
      const foundInterview = interviews.find(interview => interview.id === interviewId);
      if (foundInterview) {
        targetSessionId = session.id;
        targetInterview = foundInterview;
        break;
      }
    }

    if (!targetSessionId) {
      return res.status(404).json({
        success: false,
        message: 'Interview not found'
      });
    }

    // Step 4: Update interview with file, transcription, draft, and mark as completed
    const updateData = {
      ...targetInterview,
      status: 'completed',
      duration: interviewMetadata.duration,
      wordCount: interviewMetadata.wordCount,
      file_upload: fileMetadata,
      transcription: transcription,
      ai_draft: generatedDraft,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const result = await supabaseService.updateInterviewInSession(targetSessionId, interviewId, updateData);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to update interview with file upload',
        error: result.error
      });
    }

    // Log file upload
    await req.logFileUploaded(targetSessionId, interviewId, fileMetadata);
    
    // Log draft generation
    if (generatedDraft) {
      await req.logDraftGenerated(targetSessionId, interviewId, generatedDraft);
    }

    res.json({
      success: true,
      data: {
        interview: result.data,
        fileMetadata,
        transcription: isAudioFile ? transcription : null,
        draft: generatedDraft,
        processingComplete: true
      },
      message: `File uploaded and processed successfully. ${isAudioFile ? 'Audio transcribed, ' : ''}AI draft generated, interview marked as completed.`
    });

  } catch (error) {
    console.error('Error in uploadInterviewFile:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while uploading and processing file',
      error: error.message
    });
  }
};

const _getFileDuration = (file) => {
  const audioDuration = Math.random() * 60;
  return audioDuration.toFixed(2);
};

const _getFileWordCount = (transcription) => {
  const text = transcription;
  return text.split(' ').length;
};

// @desc    Delete interview from session
// @route   DELETE /api/admin/sessions/:id/interviews/:interviewId
// @access  Admin
const deleteInterview = async (req, res) => {
  try {
    const { id: sessionId, interviewId } = req.params;

    const result = await supabaseService.deleteInterviewFromSession(interviewId, sessionId);

    if (!result.success) {
      if (result.error === 'Interview not found') {
        return res.status(404).json({
          success: false,
          message: 'Interview not found'
        });
      }
      return res.status(500).json({
        success: false,
        message: 'Failed to delete interview',
        error: result.error
      });
    }

    // Log interview deletion
    try {
      console.log('Attempting to log interview deletion:', {
        sessionId,
        interviewId,
        userId: req.user?.id,
        userEmail: req.user?.email
      });
      await req.logInterviewDeleted(sessionId, interviewId);
      console.log('Interview deletion logged successfully');
    } catch (logError) {
      console.error('Failed to log interview deletion:', logError);
    }

    res.json({
      success: true,
      data: result.data,
      message: 'Interview deleted successfully'
    });

  } catch (error) {
    console.error('Error in deleteInterview:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting interview',
      error: error.message
    });
  }
};

module.exports = {
  getAllSessions,
  getSessionById,
  createSession,
  updateSession,
  updateSessionScheduling,
  addInterviewToSession,
  deleteSession,
  getSessionStats,
  updateInterview,
  uploadInterviewFile,
  deleteInterview
};
