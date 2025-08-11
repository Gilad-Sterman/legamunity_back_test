const supabaseService = require('../services/supabaseService');
const loggingService = require('../services/loggingService');
const fullLifeStoriesService = require('../services/fullLifeStoriesService');

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

    // Create interviews from frontend data in normalized interviews table
    const interviewService = require('../services/interviewService');
    const sessionId = result.data.id;
    
    try {
      // Use interviews from frontend sessionData if provided
      const interviewsToCreate = sessionData.interviews || [];
      
      if (interviewsToCreate.length > 0) {
        console.log(`Creating ${interviewsToCreate.length} interviews from frontend data for session ${sessionId}`);
        
        const createdInterviews = [];
        for (const frontendInterview of interviewsToCreate) {
          // Map frontend interview structure to backend structure
          const interviewData = {
            type: frontendInterview.type || 'life_story',
            duration: frontendInterview.duration || 90,
            location: 'online', // Default location
            status: frontendInterview.status || 'pending',
            notes: frontendInterview.notes || '',
            content: {
              name: frontendInterview.name || `Interview ${frontendInterview.id}`,
              isFriendInterview: frontendInterview.type === 'friend_verification' || false
            }
          };
          
          const interviewResult = await interviewService.createInterview(sessionId, interviewData);
          if (interviewResult.success) {
            createdInterviews.push(interviewResult.data);
          } else {
            console.error('Failed to create interview:', interviewResult.error);
          }
        }

        console.log(`Successfully created ${createdInterviews.length} interviews for session ${sessionId}`);
      } else {
        console.log(`No interviews provided in frontend data for session ${sessionId}`);
      }
    } catch (interviewError) {
      console.error('Error creating interviews from frontend data:', interviewError);
      // Don't fail the session creation if interview creation fails
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

    // Use the new service method that handles both separate interviews table and legacy interviews
    const result = await supabaseService.updateSessionScheduling(id, scheduling_details);

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

    // Log the scheduling update
    if (req.user) {
      await loggingService.logEvent({
        event_type: 'session_scheduling_updated',
        user_id: req.user.id,
        session_id: id,
        details: {
          scheduling_details,
          message: 'Session scheduling updated and pending interviews changed to scheduled'
        },
        request_context: {
          ip: req.ip,
          user_agent: req.get('User-Agent')
        }
      });
    }

    res.json({
      success: true,
      data: result.data,
      message: 'Session scheduling updated successfully and pending interviews changed to scheduled'
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
    const stats = await supabaseService.getSessionStats();
    res.json(stats);
  } catch (error) {
    console.error('Error fetching session statistics:', {
      message: error.message,
      details: error.stack,
      hint: error.hint || '',
      code: error.code || ''
    });
    
    // Return default stats when network fails
    const defaultStats = {
      success: true,
      data: {
        totalSessions: 0,
        activeSessions: 0,
        completedSessions: 0,
        completionRate: 0,
        totalInterviews: 0,
        completedInterviews: 0,
        interviewCompletionRate: 0,
        totalDrafts: 0,
        approvedDrafts: 0,
        draftApprovalRate: 0,
        recentActivity: {
          interviews: 0,
          drafts: 0
        }
      },
      message: 'Statistics temporarily unavailable due to connectivity issues'
    };
    
    res.json(defaultStats);
  }
};

// @desc    Update interview within a session
// @route   PUT /api/admin/interviews/:id
// @access  Admin
const updateInterview = async (req, res) => {
  try {
    const { id: interviewId } = req.params;
    const updateData = req.body;

    // First try to find the interview in the normalized interviews table
    const supabase = require('../config/database');
    const { data: interview, error: findError } = await supabase
      .from('interviews')
      .select('id, session_id')
      .eq('id', interviewId)
      .single();

    if (findError && findError.code !== 'PGRST116') { // PGRST116 = no rows found
      return res.status(500).json({
        success: false,
        message: 'Database error while finding interview',
        error: findError.message
      });
    }

    let targetSessionId = null;

    if (interview) {
      // Found in normalized table
      targetSessionId = interview.session_id;
    } else {
      // Not found in normalized table, search legacy sessions
      const sessionsResult = await supabaseService.getSessions();
      if (!sessionsResult.success) {
        return res.status(500).json({
          success: false,
          message: 'Failed to fetch sessions to find interview',
          error: sessionsResult.error
        });
      }

      // Find the session that contains this interview in legacy structure
      for (const session of sessionsResult.data) {
        const interviews = session.preferences?.interviews || [];
        if (interviews.some(interview => interview.id === interviewId)) {
          targetSessionId = session.id;
          break;
        }
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
    // Calculate actual file duration and word count
    const calculatedDuration = isAudioFile ? _getFileDuration(file) : _getEstimatedReadingDuration(processedContent);
    const calculatedWordCount = _getFileWordCount(isAudioFile ? transcription : processedContent);

    const interviewMetadata = {
      id: interviewId,
      name: `Interview ${interviewId}`,
      type: isAudioFile ? 'audio_interview' : 'text_interview',
      fileType: file.mimetype,
      duration: calculatedDuration,
      wordCount: calculatedWordCount,
    };

    const generatedDraft = await aiService.generateDraft(processedContent, interviewMetadata);

    // Step 3: Find the interview in normalized table
    const supabase = require('../config/database');
    const { data: interview, error: findError } = await supabase
      .from('interviews')
      .select('*')
      .eq('id', interviewId)
      .single();

    if (findError && findError.code !== 'PGRST116') { // PGRST116 = no rows found
      return res.status(500).json({
        success: false,
        message: 'Database error while finding interview',
        error: findError.message
      });
    }

    let targetSessionId = null;
    let targetInterview = null;

    if (interview) {
      // Found in normalized table
      targetSessionId = interview.session_id;
      targetInterview = interview;
    } else {
      // Not found in normalized table, search legacy sessions
      const sessionsResult = await supabaseService.getSessions();
      if (!sessionsResult.success) {
        return res.status(500).json({
          success: false,
          message: 'Failed to fetch sessions to find interview'
        });
      }

      // Find the session that contains this interview in legacy structure
      for (const session of sessionsResult.data) {
        const interviews = session.preferences?.interviews || [];
        const foundInterview = interviews.find(interview => interview.id === interviewId);
        if (foundInterview) {
          targetSessionId = session.id;
          targetInterview = foundInterview;
          break;
        }
      }
    }

    if (!targetSessionId) {
      return res.status(404).json({
        success: false,
        message: 'Interview not found'
      });
    }

    // Step 4: Update interview with file, transcription, and mark as completed
    const updateData = {
      status: 'completed',
      duration: calculatedDuration,
      notes: targetInterview.notes || '',
      content: {
        ...targetInterview.content,
        file_upload: fileMetadata,
        transcription: transcription,
        wordCount: calculatedWordCount
      },
      completed_date: new Date().toISOString()
    };

    const result = await supabaseService.updateInterviewInSession(targetSessionId, interviewId, updateData);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to update interview with file upload',
        error: result.error
      });
    }

    // Step 5: Create draft for this specific interview
    const draftContent = {
      summary: generatedDraft.summary || "This interview session captured valuable insights about the subject's life journey through file upload and AI processing.",
      sections: generatedDraft.sections || {
        introduction: "Based on the uploaded file, this section introduces the subject and provides context for their life story.",
        earlyLife: "Early life experiences and memories captured from the interview content.",
        careerJourney: "Professional journey and career milestones discussed in the interview.",
        personalRelationships: "Personal relationships and family connections explored during the conversation.",
        lifeWisdom: "Wisdom and life lessons shared during the interview session.",
        conclusion: "Summary and reflection on the life story captured through this interview."
      },
      keyThemes: generatedDraft.keyThemes || [
        "Personal Growth",
        "Life Experiences", 
        "Family and Heritage",
        "Career Development",
        "Wisdom and Reflection"
      ],
      metadata: {
        wordCount: calculatedWordCount,
        generatedAt: new Date().toISOString(),
        sourceInterview: interviewId,
        processingMethod: "AI_FILE_UPLOAD_GENERATION",
        estimatedReadingTime: `${Math.ceil(calculatedWordCount / 250)} minutes`,
        fileType: file.mimetype,
        duration: calculatedDuration,
        aiModel: generatedDraft.metadata?.ai_model || 'simulated'
      }
    };

    // Create new draft for this interview (using session_id with interview reference in metadata)
    // First check existing drafts to determine the next version number
    const existingDraftsResult = await supabaseService.getDraftsBySessionId(targetSessionId);
    let nextVersion = 1;
    
    if (existingDraftsResult.success && existingDraftsResult.data.length > 0) {
      const latestDraft = existingDraftsResult.data[0]; // Already sorted by version desc
      nextVersion = latestDraft.version + 1;
    }

    const draftData = {
      session_id: targetSessionId,
      version: nextVersion,
      stage: 'first_draft',
      content: draftContent
    };
    
    const draftResult = await supabaseService.createDraft(draftData);

    if (!draftResult.success) {
      console.error('Failed to create draft:', draftResult.error);
      // Don't fail the entire upload if draft creation fails
      // The interview was already updated successfully
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
        draft: draftResult.success ? draftResult.data : null,
        draftCreated: draftResult.success,
        processingComplete: true
      },
      message: `File uploaded and processed successfully. ${isAudioFile ? 'Audio transcribed, ' : ''}${draftResult.success ? 'Draft created in drafts table, ' : ''}interview marked as completed.`
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
  // For audio files, simulate realistic duration calculation based on file size
  // In a real implementation, this would use a library like ffprobe to get actual duration
  const avgBitrate = 128; // kbps for typical audio
  const fileSizeKB = file.size / 1024;
  const estimatedDurationSeconds = (fileSizeKB * 8) / avgBitrate;
  
  // Convert to minutes and add some realistic variation
  const durationMinutes = Math.max(1, Math.round(estimatedDurationSeconds / 60));
  
  // Cap at reasonable interview length (max 3 hours)
  return Math.min(durationMinutes, 180);
};

const _getEstimatedReadingDuration = (text) => {
  // Estimate reading duration for text content
  // Average reading speed is about 200-250 words per minute
  const wordsPerMinute = 225;
  const wordCount = _getFileWordCount(text);
  const estimatedMinutes = Math.max(1, Math.round(wordCount / wordsPerMinute));
  
  // Cap at reasonable reading time (max 2 hours)
  return Math.min(estimatedMinutes, 120);
};

const _getFileWordCount = (text) => {
  if (!text || typeof text !== 'string') return 0;
  
  // Clean the text and split by whitespace
  const words = text.trim().split(/\s+/).filter(word => word.length > 0);
  return words.length;
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

// @desc    Generate full life story from all session data and approved drafts
// @route   POST /api/admin/sessions/:id/generate-full-story
// @access  Admin
const generateFullLifeStory = async (req, res) => {
  try {
    const { id: sessionId } = req.params;

    // Step 1: Get session with all interviews and drafts
    const sessionResult = await supabaseService.getSessionById(sessionId);
    if (!sessionResult.success) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    const session = sessionResult.data;
    const interviews = session.interviews || [];

    // Step 2: Check if session has approved drafts (STRICT CHECK)
    const approvedDrafts = interviews.filter(interview => {
      const draft = interview.ai_draft;
      if (!draft) return false;
      
      // Only consider explicitly approved drafts
      const stage = draft.metadata?.stage || draft.stage;
      return stage === 'approved';
    });

    if (approvedDrafts.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No approved drafts found for this session. Drafts must be explicitly approved to generate full life story.'
      });
    }

    // Step 3: Generate full life story using AI service
    const aiService = require('../services/aiService');
    console.log('🤖 Generating full life story for session:', sessionId);
    
    const fullStoryData = {
      sessionId,
      clientInfo: {
        name: session.client_name,
        age: session.client_age,
        preferences: session.preferences
      },
      approvedDrafts: approvedDrafts.map(interview => ({
        interviewId: interview.id,
        interviewName: interview.name,
        draft: interview.ai_draft,
        transcription: interview.content?.transcription,
        notes: interview.notes,
        duration: interview.duration
      })),
      sessionNotes: session.notes,
      totalInterviews: interviews.length,
      completedInterviews: interviews.filter(i => i.status === 'completed').length
    };

    const fullLifeStory = await aiService.generateFullLifeStory(fullStoryData);

    // Step 4: Save to dedicated full_life_stories table
    const fullLifeStoriesService = require('../services/fullLifeStoriesService');
    
    const storyData = {
      sessionId,
      title: fullLifeStory.title,
      subtitle: fullLifeStory.subtitle,
      content: fullLifeStory.content,
      generatedBy: req.user?.email || 'admin',
      userId: req.user?.id || null,
      sourceMetadata: {
        approvedDrafts: approvedDrafts.length,
        totalInterviews: interviews.length,
        completedInterviews: interviews.filter(i => i.status === 'completed').length,
        generationDate: new Date().toISOString(),
        approvedDraftIds: approvedDrafts.map(d => d.id),
        sessionData: {
          clientName: session.client_name,
          clientAge: session.client_age,
          sessionStatus: session.status
        }
      },
      generationStats: {
        processingTime: fullLifeStory.metadata?.processingTime || 0,
        aiModel: fullLifeStory.metadata?.aiModel || 'mock-ai-v1.0',
        sourceInterviews: approvedDrafts.length,
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
    try {
      await req.logEvent({
        eventType: 'session',
        eventAction: 'full_story_generated',
        sessionId: sessionId,
        resourceId: saveResult.data.id,
        resourceType: 'full_life_story',
        eventData: {
          story_id: saveResult.data.id,
          version: saveResult.data.version,
          source_drafts: approvedDrafts.length,
          total_words: fullLifeStory.content?.totalWords || 0,
          processing_time: fullLifeStory.metadata?.processingTime || 0
        },
        severity: 'info'
      });
    } catch (logError) {
      console.error('Failed to log full story generation:', logError);
    }

    res.status(200).json({
      success: true,
      message: 'Full life story generated successfully',
      data: {
        story: saveResult.data,
        session: session,
        generationStats: {
          totalWords: fullLifeStory.content?.totalWords || 0,
          processingTime: fullLifeStory.metadata?.processingTime || 0,
          sourceDrafts: approvedDrafts.length
        }
      }
    });

  } catch (error) {
    console.error('Error in generateFullLifeStory:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate full life story',
      error: error.message
    });
  }
};

// @desc    Get all full life stories for a session (with version history)
// @route   GET /api/sessions-supabase/:id/full-stories
// @access  Admin
const getSessionFullStories = async (req, res) => {
  try {
    const { id: sessionId } = req.params;

    // Get all full life stories for this session, ordered by version (newest first)
    const stories = await fullLifeStoriesService.getFullLifeStoriesBySession(sessionId);

    if (!stories.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch full life stories',
        error: stories.error
      });
    }

    res.status(200).json({
      success: true,
      data: stories.data,
      message: `Retrieved ${stories.data.length} full life stories`
    });

  } catch (error) {
    console.error('Error in getSessionFullStories:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch session full life stories',
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
  deleteInterview,
  generateFullLifeStory,
  getSessionFullStories
};
