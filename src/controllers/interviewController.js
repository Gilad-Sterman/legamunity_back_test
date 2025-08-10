// const { v4: uuidv4 } = require('uuid');

// // Mock data for interviews - will be replaced with Supabase later
// const mockInterviews = [
//   {
//     id: 'interview_001',
//     sessionId: 'session_001',
//     type: 'technical',
//     interviewer: {
//       id: 'friend_001',
//       name: 'Sarah Wilson',
//       email: 'sarah.wilson@example.com'
//     },
//     scheduledAt: '2024-01-15T10:00:00Z',
//     startedAt: '2024-01-15T10:05:00Z',
//     completedAt: '2024-01-15T11:05:00Z',
//     duration: 60,
//     status: 'completed',
//     location: 'online',
//     notes: 'Strong technical skills, good problem-solving approach',
//     isFriendInterview: false,
//     content: {
//       questions: [
//         {
//           id: 'q1',
//           question: 'Explain the difference between let, const, and var in JavaScript',
//           answer: 'Detailed explanation about scope and hoisting...',
//           timestamp: '2024-01-15T10:15:00Z'
//         }
//       ],
//       summary: 'Candidate showed strong technical understanding',
//       rating: 4.5,
//       strengths: ['Problem solving', 'Code quality'],
//       improvements: ['System design knowledge']
//     },
//     createdAt: '2024-01-15T09:00:00Z',
//     updatedAt: '2024-01-15T11:05:00Z'
//   }
// ];

// // Import draft service for auto-creation
// const draftService = require('../services/draftService');

// /**
//  * @desc    Get all interviews
//  * @route   GET /api/interviews
//  * @access  Admin
//  */
// const getAllInterviews = async (req, res) => {
//   try {
//     const { sessionId, status, type, page = 1, limit = 10 } = req.query;
    
//     let filteredInterviews = [...mockInterviews];
    
//     // Apply filters
//     if (sessionId) {
//       filteredInterviews = filteredInterviews.filter(interview => 
//         interview.sessionId === sessionId
//       );
//     }
    
//     if (status) {
//       filteredInterviews = filteredInterviews.filter(interview => 
//         interview.status === status
//       );
//     }
    
//     if (type) {
//       filteredInterviews = filteredInterviews.filter(interview => 
//         interview.type === type
//       );
//     }
    
//     // Pagination
//     const startIndex = (page - 1) * limit;
//     const endIndex = page * limit;
//     const paginatedInterviews = filteredInterviews.slice(startIndex, endIndex);
    
//     res.json({
//       success: true,
//       data: paginatedInterviews,
//       pagination: {
//         page: parseInt(page),
//         limit: parseInt(limit),
//         total: filteredInterviews.length,
//         pages: Math.ceil(filteredInterviews.length / limit)
//       }
//     });
//   } catch (error) {
//     console.error('Error fetching interviews:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Server error while fetching interviews'
//     });
//   }
// };

// /**
//  * @desc    Get interview by ID
//  * @route   GET /api/interviews/:id
//  * @access  Admin
//  */
// const getInterviewById = async (req, res) => {
//   try {
//     const { id } = req.params;
    
//     const interview = mockInterviews.find(interview => interview.id === id);
    
//     if (!interview) {
//       return res.status(404).json({
//         success: false,
//         message: 'Interview not found'
//       });
//     }
    
//     res.json({
//       success: true,
//       data: interview
//     });
//   } catch (error) {
//     console.error('Error fetching interview:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Server error while fetching interview'
//     });
//   }
// };

// /**
//  * @desc    Start an interview
//  * @route   POST /api/interviews/:id/start
//  * @access  Admin
//  */
// const startInterview = async (req, res) => {
//   try {
//     const { id } = req.params;
    
//     const interviewIndex = mockInterviews.findIndex(interview => interview.id === id);
    
//     if (interviewIndex === -1) {
//       return res.status(404).json({
//         success: false,
//         message: 'Interview not found'
//       });
//     }
    
//     // Update interview status to in-progress
//     mockInterviews[interviewIndex] = {
//       ...mockInterviews[interviewIndex],
//       status: 'in-progress',
//       startedAt: new Date().toISOString(),
//       updatedAt: new Date().toISOString()
//     };
    
//     res.json({
//       success: true,
//       data: mockInterviews[interviewIndex],
//       message: 'Interview started successfully'
//     });
//   } catch (error) {
//     console.error('Error starting interview:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Server error while starting interview'
//     });
//   }
// };

// /**
//  * @desc    Complete an interview (triggers auto-draft creation)
//  * @route   POST /api/interviews/:id/complete
//  * @access  Admin
//  */
// const completeInterview = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const { content, notes, rating } = req.body;
    
//     const interviewIndex = mockInterviews.findIndex(interview => interview.id === id);
    
//     if (interviewIndex === -1) {
//       return res.status(404).json({
//         success: false,
//         message: 'Interview not found'
//       });
//     }
    
//     // Update interview with completion data
//     const completedInterview = {
//       ...mockInterviews[interviewIndex],
//       status: 'completed',
//       completedAt: new Date().toISOString(),
//       updatedAt: new Date().toISOString(),
//       content: content || mockInterviews[interviewIndex].content,
//       notes: notes || mockInterviews[interviewIndex].notes,
//       rating: rating || mockInterviews[interviewIndex].rating
//     };
    
//     mockInterviews[interviewIndex] = completedInterview;
    
//     // **KEY FEATURE: Auto-trigger draft creation/update**
//     try {
//       const draftResult = await draftService.handleInterviewCompletion(completedInterview);
      
//       res.json({
//         success: true,
//         data: completedInterview,
//         draft: draftResult,
//         message: 'Interview completed successfully and draft updated'
//       });
//     } catch (draftError) {
//       console.error('Error creating/updating draft:', draftError);
      
//       // Still return success for interview completion, but note draft issue
//       res.json({
//         success: true,
//         data: completedInterview,
//         message: 'Interview completed successfully, but draft update failed',
//         draftError: draftError.message
//       });
//     }
//   } catch (error) {
//     console.error('Error completing interview:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Server error while completing interview'
//     });
//   }
// };

// /**
//  * @desc    Update interview content during session
//  * @route   PUT /api/interviews/:id/content
//  * @access  Admin
//  */
// const updateInterviewContent = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const { content } = req.body;
    
//     const interviewIndex = mockInterviews.findIndex(interview => interview.id === id);
    
//     if (interviewIndex === -1) {
//       return res.status(404).json({
//         success: false,
//         message: 'Interview not found'
//       });
//     }
    
//     // Update interview content
//     mockInterviews[interviewIndex] = {
//       ...mockInterviews[interviewIndex],
//       content: {
//         ...mockInterviews[interviewIndex].content,
//         ...content
//       },
//       updatedAt: new Date().toISOString()
//     };
    
//     res.json({
//       success: true,
//       data: mockInterviews[interviewIndex],
//       message: 'Interview content updated successfully'
//     });
//   } catch (error) {
//     console.error('Error updating interview content:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Server error while updating interview content'
//     });
//   }
// };

// /**
//  * @desc    Update interview details (name, notes, etc.)
//  * @route   PUT /api/interviews/:id
//  * @access  Admin
//  */
// const updateInterview = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const updateData = req.body;
    
//     // Import shared mock data
//     const { mockSessions } = require('../data/mockData');
    
//     // Find interview in sessions first (most common case)
//     let foundInterview = null;
//     let foundSession = null;
//     let interviewIndex = -1;
    
//     for (const session of mockSessions) {
//       if (session.interviews) {
//         interviewIndex = session.interviews.findIndex(interview => interview.id === id);
//         if (interviewIndex !== -1) {
//           foundInterview = session.interviews[interviewIndex];
//           foundSession = session;
//           break;
//         }
//       }
//     }
    
//     // If not found in sessions, check standalone mockInterviews
//     if (!foundInterview) {
//       interviewIndex = mockInterviews.findIndex(interview => interview.id === id);
//       if (interviewIndex !== -1) {
//         foundInterview = mockInterviews[interviewIndex];
//       }
//     }
    
//     if (!foundInterview) {
//       return res.status(404).json({
//         success: false,
//         message: 'Interview not found'
//       });
//     }
    
//     // Update interview with new data
//     const updatedInterview = {
//       ...foundInterview,
//       ...updateData,
//       updatedAt: new Date().toISOString()
//     };
    
//     // Update the interview in the appropriate location
//     if (foundSession) {
//       foundSession.interviews[interviewIndex] = updatedInterview;
//       foundSession.updatedAt = new Date().toISOString();
//     } else {
//       mockInterviews[interviewIndex] = updatedInterview;
//     }
    
//     console.log('✏️ Interview updated:', {
//       interviewId: id,
//       updatedFields: Object.keys(updateData),
//       newName: updateData.name || 'unchanged',
//       location: foundSession ? 'session' : 'standalone'
//     });
    
//     res.json({
//       success: true,
//       data: updatedInterview,
//       message: 'Interview updated successfully'
//     });
    
//   } catch (error) {
//     console.error('Error updating interview:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Server error while updating interview',
//       error: error.message
//     });
//   }
// };

// /**
//  * @desc    Add new interview to a session
//  * @route   POST /api/sessions/:sessionId/interviews
//  * @access  Admin
//  */
// const addInterviewToSession = async (req, res) => {
//   try {
//     const { sessionId } = req.params;
//     const { name, type = 'life_story', duration = 90, status = 'pending' } = req.body;
    
//     // Generate new interview ID
//     const interviewId = `interview_${sessionId}_${Date.now()}`;
    
//     // Create new interview object
//     const newInterview = {
//       id: interviewId,
//       sessionId,
//       name: name || `new interview ${Date.now()}`,
//       type,
//       status,
//       duration,
//       file_upload: null,
//       notes: '',
//       isFriendInterview: false,
//       createdAt: new Date().toISOString(),
//       updatedAt: new Date().toISOString()
//     };
    
//     // Add to mock interviews array
//     mockInterviews.push(newInterview);
    
//     console.log('➕ New interview added:', {
//       interviewId: newInterview.id,
//       sessionId,
//       name: newInterview.name,
//       type: newInterview.type
//     });
    
//     res.status(201).json({
//       success: true,
//       data: newInterview,
//       message: 'Interview added successfully'
//     });
//   } catch (error) {
//     console.error('Error adding interview:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Server error while adding interview'
//     });
//   }
// };

// /**
//  * @desc    Upload file for interview and process with AI
//  * @route   POST /api/interviews/:interviewId/upload
//  * @access  Admin
//  */
// const uploadInterviewFile = async (req, res) => {
//   try {
//     const { interviewId } = req.params;
    
//     if (!req.file) {
//       return res.status(400).json({
//         success: false,
//         message: 'No file uploaded'
//       });
//     }
    
//     // Import services
//     const aiService = require('../services/aiService');
//     const interviewService = require('../services/interviewService');
//     const supabaseService = require('../services/supabaseService');
    
//     // Only use normalized interviews table - no more legacy fallback
//     const normalizedResult = await interviewService.getInterviewById(interviewId);
//     if (!normalizedResult.success || !normalizedResult.data) {
//       return res.status(404).json({
//         success: false,
//         message: 'Interview not found'
//       });
//     }
    
//     const foundInterview = normalizedResult.data;
//     console.log('📁 Found interview in normalized table:', interviewId);
    
//     console.log('📁 File uploaded for interview:', {
//       interviewId,
//       fileName: req.file.originalname,
//       fileSize: req.file.size,
//       filePath: req.file.path
//     });
    
//     // Store file information in interview content
//     const fileInfo = {
//       fileName: req.file.filename,
//       originalName: req.file.originalname,
//       filePath: req.file.path,
//       fileSize: req.file.size,
//       mimeType: req.file.mimetype,
//       uploadedAt: new Date().toISOString()
//     };
    
//     // Calculate file duration based on file type
//     const audioTypes = ['audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/aac', 'audio/ogg', 'audio/webm', 'audio/flac'];
//     const isAudioFile = audioTypes.includes(req.file.mimetype);
    
//     let calculatedDuration;
//     if (isAudioFile) {
//       // For audio files, estimate duration based on file size and bitrate
//       const avgBitrate = 128; // kbps for typical audio
//       const fileSizeKB = req.file.size / 1024;
//       const estimatedDurationSeconds = (fileSizeKB * 8) / avgBitrate;
//       calculatedDuration = Math.max(1, Math.round(estimatedDurationSeconds / 60));
//       calculatedDuration = Math.min(calculatedDuration, 180); // Cap at 3 hours
//     } else {
//       // For text files, estimate reading duration (will be refined after processing)
//       calculatedDuration = Math.max(5, Math.round(req.file.size / 1000)); // Rough estimate
//       calculatedDuration = Math.min(calculatedDuration, 120); // Cap at 2 hours
//     }
    
//     // Process AI synchronously
//     console.log('🤖 Starting synchronous AI processing for interview:', interviewId);
    
//     // Update interview status to processing
//     await interviewService.updateInterview(interviewId, {
//       status: 'processing',
//       duration: calculatedDuration,
//       content: {
//         ...foundInterview.content,
//         file_upload: fileInfo
//       }
//     });
    
//     let transcription = null;
//     let aiDraft = null;
//     let processingStatus = 'completed';
//     let errorMessage = null;
    
//     try {
//       // Run AI processing synchronously
//       const aiResult = await aiService.processInterviewFile(req.file.path, foundInterview);
//       transcription = aiResult.transcription;
//       aiDraft = aiResult.draft;
      
//       console.log('✅ AI processing completed synchronously for interview:', interviewId);
      
//     } catch (aiError) {
//       console.error('❌ AI processing failed for interview:', interviewId, aiError);
//       processingStatus = 'failed';
//       errorMessage = aiError.message;
//     }
    
//     // Update interview with final status
//     const updateResult = await interviewService.updateInterview(interviewId, {
//       status: processingStatus,
//       duration: calculatedDuration,
//       content: {
//         ...foundInterview.content,
//         file_upload: fileInfo,
//         transcription: transcription,
//         error: errorMessage
//       },
//       completed_date: processingStatus === 'completed' ? new Date().toISOString() : null
//     });
    
//     if (!updateResult.success) {
//       throw new Error('Failed to update interview: ' + updateResult.error);
//     }
    
//     // If AI processing was successful, create draft in drafts table
//     let createdDraft = null;
//     if (processingStatus === 'completed' && aiDraft) {
//       try {
//         const draftResult = await supabaseService.createDraft({
//           session_id: foundInterview.session_id,
//           interview_id: interviewId,
//           content: aiDraft,
//           stage: 'first_draft',
//           version: 1,
//           completion_percentage: 75.0, // Initial completion based on single interview
//           metadata: {
//             source_interview_id: interviewId,
//             source_file: fileInfo,
//             generated_at: new Date().toISOString(),
//             ai_model: 'mock-ai-v1'
//           }
//         });
        
//         if (draftResult.success) {
//           createdDraft = draftResult.data;
//           console.log('✅ Draft created successfully:', createdDraft.id);
//         } else {
//           console.error('❌ Failed to create draft:', draftResult.error);
//         }
//       } catch (draftError) {
//         console.error('❌ Error creating draft:', draftError);
//       }
//     }
    
//     // Get the updated interview for response
//     const finalResult = await interviewService.getInterviewById(interviewId);
//     const updatedInterview = finalResult.success ? finalResult.data : foundInterview;
    
//     res.json({
//       success: true,
//       message: `File uploaded and processed successfully. Interview status: ${processingStatus}`,
//       data: {
//         interview: updatedInterview,
//         draft: createdDraft,
//         file: {
//           fileName: req.file.filename,
//           originalName: req.file.originalname,
//           size: req.file.size
//         }
//       }
//     });
    
//   } catch (error) {
//     console.error('Error uploading interview file:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Server error while uploading file',
//       error: error.message
//     });
//   }
// };

// // Note: Background processing function removed - now processing synchronously in uploadInterviewFile

// module.exports = {
//   getAllInterviews,
//   getInterviewById,
//   startInterview,
//   completeInterview,
//   updateInterview,
//   updateInterviewContent,
//   addInterviewToSession,
//   uploadInterviewFile
// };
