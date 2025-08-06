const { v4: uuidv4 } = require('uuid');
const stageValidationService = require('./stageValidationService');

// We'll access mock data directly from the files since they're not properly exported yet
// In production, this would be database queries

/**
 * Draft Service - Handles auto-creation and versioning of drafts
 * Based on interview completion events
 */
class DraftService {
  
  /**
   * Main handler for interview completion - creates or updates drafts
   * @param {Object} completedInterview - The completed interview object
   * @returns {Object} - Draft creation/update result
   */
  async handleInterviewCompletion(completedInterview) {
    try {
      const { sessionId, id: interviewId } = completedInterview;
      
      // Get session data to understand context
      const sessionData = await this.getSessionData(sessionId);
      if (!sessionData) {
        throw new Error(`Session ${sessionId} not found`);
      }
      
      // Get all completed interviews for this session
      const completedInterviews = this.getCompletedInterviewsForSession(sessionData);
      
      // Check if draft already exists for this session
      const existingDraft = await this.findDraftBySessionId(sessionId);
      
      if (existingDraft) {
        // Update existing draft with new interview data
        return await this.updateExistingDraft(existingDraft, completedInterviews, sessionData);
      } else {
        // Create new draft
        return await this.createNewDraft(completedInterviews, sessionData);
      }
      
    } catch (error) {
      console.error('Error in handleInterviewCompletion:', error);
      throw error;
    }
  }
  
  /**
   * Get session data by ID
   * @param {string} sessionId 
   * @returns {Object|null} Session data
   */
  async getSessionData(sessionId) {
    // Enhanced mock session with multiple interviews for testing version management
    // In production, this would be a database query
    const mockSession = {
      id: sessionId,
      user: {
        id: 'user_001',
        name: 'John Doe',
        email: 'john.doe@example.com'
      },
      position: 'Software Engineer',
      status: 'in-progress',
      interviews: [
        {
          id: 'interview_001',
          type: 'technical',
          status: 'completed',
          interviewer: { name: 'Sarah Wilson', id: 'interviewer_001' },
          scheduledAt: '2025-01-25T10:00:00Z',
          completedAt: '2025-01-25T11:00:00Z',
          duration: 60,
          content: {
            rating: 4.5,
            summary: 'Strong technical skills, excellent problem-solving approach',
            strengths: ['JavaScript expertise', 'Algorithm design', 'Clean code'],
            improvements: ['System design patterns', 'Database optimization'],
            skills: ['JavaScript', 'React', 'Node.js', 'MongoDB']
          }
        },
        {
          id: 'interview_002',
          type: 'behavioral',
          status: 'completed',
          interviewer: { name: 'Mike Johnson', id: 'interviewer_002' },
          scheduledAt: '2025-01-25T14:00:00Z',
          completedAt: '2025-01-25T15:00:00Z',
          duration: 45,
          content: {
            rating: 4.2,
            summary: 'Great communication skills and team collaboration',
            strengths: ['Leadership potential', 'Communication', 'Team player'],
            improvements: ['Conflict resolution', 'Presentation skills'],
            achievements: ['Led team of 4 developers', 'Improved deployment process']
          }
        },
        {
          id: 'interview_003',
          type: 'friend',
          status: 'scheduled',
          interviewer: { name: 'Emma Davis', id: 'interviewer_003' },
          scheduledAt: '2025-01-26T10:00:00Z',
          duration: 30
        }
      ]
    };
    return mockSession;
  }
  
  /**
   * Get all completed interviews for a session
   * @param {Object} sessionData 
   * @returns {Array} Completed interviews
   */
  getCompletedInterviewsForSession(sessionData) {
    return sessionData.interviews.filter(interview => interview.status === 'completed');
  }
  
  /**
   * Find existing draft by session ID
   * @param {string} sessionId 
   * @returns {Object|null} Existing draft
   */
  async findDraftBySessionId(sessionId) {
    // For now, return null to always create new drafts for testing
    // In production, this would be a database query
    return null;
  }
  
  /**
   * Create new draft from completed interviews
   * @param {Array} completedInterviews 
   * @param {Object} sessionData 
   * @returns {Object} New draft
   */
  async createNewDraft(completedInterviews, sessionData) {
    // Determine initial stage with validation
    const initialStage = this.determineStage(completedInterviews, sessionData);
    
    // Validate the initial stage transition (from null to initial stage)
    const stageValidation = stageValidationService.validateTransition(
      null, 
      initialStage, 
      {
        draftData: { interviewCount: completedInterviews.length },
        sessionData: sessionData,
        isAdminAction: false,
        automaticTrigger: true
      }
    );
    
    if (!stageValidation.valid) {
      throw new Error(`Invalid initial stage '${initialStage}': ${stageValidation.reason}`);
    }
    
    const newDraft = {
      id: `draft-${uuidv4()}`,
      sessionId: sessionData.id,
      userId: sessionData.user.id,
      title: `${sessionData.position || 'Position'} Assessment - ${sessionData.user.name}`,
      content: this.aggregateInterviewContent(completedInterviews),
      stage: initialStage,
      version: 1,
      progress: this.calculateProgress(completedInterviews, sessionData),
      user: {
        uid: sessionData.user.id,
        displayName: sessionData.user.name,
        email: sessionData.user.email
      },
      session: {
        id: sessionData.id,
        title: sessionData.position || 'Position Assessment'
      },
      interviewCount: completedInterviews.length,
      totalInterviews: sessionData.interviews.length,
      completionPercentage: Math.round((completedInterviews.length / sessionData.interviews.length) * 100),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastInterviewCompleted: this.getLatestInterviewDate(completedInterviews),
      reviewedBy: null,
      approvedBy: null,
      rejectionReason: null,
      stageMetadata: stageValidationService.getStageMetadata(initialStage),
      availableTransitions: stageValidationService.getAvailableTransitions(initialStage, {
        draftData: { interviewCount: completedInterviews.length },
        sessionData: sessionData
      }),
      history: [
        {
          id: uuidv4(),
          action: 'created',
          stage: initialStage,
          version: 1,
          interviewCount: completedInterviews.length,
          timestamp: new Date().toISOString(),
          triggeredBy: 'system',
          details: `Auto-created from ${completedInterviews.length} completed interview(s)`,
          stageTransition: stageValidationService.createTransitionHistory(
            null, 
            initialStage, 
            { automaticTrigger: true, reason: 'Initial draft creation' }
          )
        }
      ]
    };
    
    // For now, just log the creation (in production, this would be database insert)
    console.log('📝 Draft would be saved to database:', {
      id: newDraft.id,
      sessionId: newDraft.sessionId,
      version: newDraft.version
    });
    
    console.log(`✅ Created new draft ${newDraft.id} for session ${sessionData.id}`);
    
    return {
      action: 'created',
      draft: newDraft,
      message: `New draft created with ${completedInterviews.length} interview(s)`
    };
  }
  
  /**
   * Update existing draft with new interview data
   * @param {Object} existingDraft 
   * @param {Array} completedInterviews 
   * @param {Object} sessionData 
   * @returns {Object} Updated draft
   */
  async updateExistingDraft(existingDraft, completedInterviews, sessionData) {
    // Enhanced version management logic
    const shouldCreateNewVersion = completedInterviews.length > existingDraft.interviewCount;
    const hasContentChanges = this.hasSignificantContentChanges(existingDraft, completedInterviews);
    
    if (shouldCreateNewVersion || hasContentChanges) {
      const newVersion = existingDraft.version + 1;
      const newStage = this.determineStage(completedInterviews, sessionData);
      
      // Validate stage transition
      const stageValidation = stageValidationService.validateTransition(
        existingDraft.stage,
        newStage,
        {
          draftData: existingDraft,
          sessionData: sessionData,
          isAdminAction: false,
          automaticTrigger: true
        }
      );
      
      if (!stageValidation.valid) {
        console.warn(`⚠️ Stage transition validation failed: ${stageValidation.reason}`);
        // Use current stage if transition is invalid
        newStage = existingDraft.stage;
      }
      
      // Enhanced content aggregation
      const aggregatedContent = this.aggregateInterviewContent(completedInterviews);
      const progressData = this.calculateProgress(completedInterviews, sessionData);
      const changesSummary = this.getChangesSummary(existingDraft, aggregatedContent);
      
      // Update draft with new version and enhanced data
      const updatedDraft = {
        ...existingDraft,
        version: newVersion,
        stage: newStage,
        content: aggregatedContent,
        progress: progressData,
        interviewCount: completedInterviews.length,
        totalInterviews: sessionData.interviews.length,
        updatedAt: new Date().toISOString(),
        lastInterviewCompleted: this.getLatestInterviewDate(completedInterviews),
        completionPercentage: Math.round((completedInterviews.length / sessionData.interviews.length) * 100),
        stageMetadata: stageValidationService.getStageMetadata(newStage),
        availableTransitions: stageValidationService.getAvailableTransitions(newStage, {
          draftData: { 
            ...existingDraft, 
            interviewCount: completedInterviews.length,
            content: aggregatedContent
          },
          sessionData: sessionData
        }),
        history: [
          ...existingDraft.history,
          {
            id: uuidv4(),
            action: shouldCreateNewVersion ? 'version_updated' : 'content_updated',
            version: newVersion,
            fromStage: existingDraft.stage,
            toStage: newStage,
            interviewCount: completedInterviews.length,
            timestamp: new Date().toISOString(),
            triggeredBy: 'system',
            details: `Auto-updated to v${newVersion} with ${completedInterviews.length}/${sessionData.interviews.length} interviews completed`,
            changes: changesSummary,
            stageTransition: newStage !== existingDraft.stage ? 
              stageValidationService.createTransitionHistory(
                existingDraft.stage,
                newStage,
                { 
                  automaticTrigger: true, 
                  reason: `Automatic stage progression due to interview completion` 
                }
              ) : null,
            validationResult: stageValidation
          }
        ]
      };
      
      // For now, just log the update (in production, this would be database update)
      console.log('📝 Draft would be updated in database:', {
        id: updatedDraft.id,
        version: updatedDraft.version,
        stage: updatedDraft.stage,
        completion: updatedDraft.completionPercentage + '%'
      });
      
      console.log(`✅ Updated draft ${existingDraft.id} to version ${newVersion} (${updatedDraft.stage})`);
      
      return {
        action: 'updated',
        draft: updatedDraft,
        message: `Draft updated to version ${newVersion} with ${completedInterviews.length}/${sessionData.interviews.length} interviews completed`,
        changes: this.getChangesSummary(existingDraft, aggregatedContent)
      };
    }
    
    return {
      action: 'no_change',
      draft: existingDraft,
      message: 'No significant changes to process'
    };
  }
  
  /**
   * Aggregate content from multiple interviews
   * @param {Array} interviews 
   * @returns {Object} Aggregated content
   */
  aggregateInterviewContent(interviews) {
    const content = {
      personal: {
        name: '',
        experience: '',
        education: ''
      },
      professional: {
        skills: [],
        achievements: [],
        ratings: {}
      },
      recommendations: {
        strengths: [],
        improvements: [],
        decision: 'pending',
        overallRating: 0
      },
      interviews: []
    };
    
    let totalRating = 0;
    let ratingCount = 0;
    
    interviews.forEach(interview => {
      // Add interview summary to content
      content.interviews.push({
        id: interview.id,
        type: interview.type,
        interviewer: interview.interviewer?.name,
        completedAt: interview.completedAt,
        rating: interview.content?.rating || interview.rating,
        summary: interview.content?.summary || interview.notes,
        strengths: interview.content?.strengths || [],
        improvements: interview.content?.improvements || []
      });
      
      // Aggregate ratings
      const rating = interview.content?.rating || interview.rating;
      if (rating) {
        totalRating += rating;
        ratingCount++;
        content.professional.ratings[interview.type] = rating;
      }
      
      // Aggregate strengths and improvements
      if (interview.content?.strengths) {
        content.recommendations.strengths.push(...interview.content.strengths);
      }
      if (interview.content?.improvements) {
        content.recommendations.improvements.push(...interview.content.improvements);
      }
      
      // Aggregate skills (from technical interviews)
      if (interview.type === 'technical' && interview.content?.skills) {
        content.professional.skills.push(...interview.content.skills);
      }
    });
    
    // Calculate overall rating
    if (ratingCount > 0) {
      content.recommendations.overallRating = (totalRating / ratingCount).toFixed(1);
    }
    
    // Remove duplicates
    content.professional.skills = [...new Set(content.professional.skills)];
    content.recommendations.strengths = [...new Set(content.recommendations.strengths)];
    content.recommendations.improvements = [...new Set(content.recommendations.improvements)];
    
    return content;
  }
  
  /**
   * Calculate progress based on completed interviews
   * @param {Array} completedInterviews 
   * @param {Object} sessionData 
   * @returns {Object} Progress data
   */
  calculateProgress(completedInterviews, sessionData) {
    const totalInterviews = sessionData.interviews.length;
    const completedCount = completedInterviews.length;
    
    const overallCompletion = Math.round((completedCount / totalInterviews) * 100);
    
    // Enhanced section progress calculation
    const sections = {
      personal: completedCount > 0 ? 100 : 0, // Basic info available once any interview is done
      professional: 0,
      recommendations: 0
    };
    
    // Professional section progress based on technical/behavioral interviews
    const professionalInterviews = completedInterviews.filter(i => 
      ['technical', 'behavioral'].includes(i.type)
    );
    const expectedProfessionalInterviews = sessionData.interviews.filter(i => 
      ['technical', 'behavioral'].includes(i.type)
    ).length;
    
    if (expectedProfessionalInterviews > 0) {
      sections.professional = Math.round((professionalInterviews.length / expectedProfessionalInterviews) * 100);
    }
    
    // Recommendations progress based on overall completion and content quality
    const hasHighQualityContent = completedInterviews.some(i => 
      i.content && i.content.rating && i.content.rating >= 4.0
    );
    sections.recommendations = Math.min(100, overallCompletion * (hasHighQualityContent ? 0.9 : 0.7));
    
    return {
      completion: overallCompletion,
      sections: {
        personal: Math.round(sections.personal),
        professional: Math.round(sections.professional),
        recommendations: Math.round(sections.recommendations)
      },
      interviewTypes: this.getInterviewTypeProgress(completedInterviews, sessionData)
    };
  }
  
  /**
   * Check if there are significant content changes
   * @param {Object} existingDraft 
   * @param {Array} completedInterviews 
   * @returns {boolean}
   */
  hasSignificantContentChanges(existingDraft, completedInterviews) {
    // Check if any interview content has changed significantly
    const existingInterviewIds = existingDraft.content.interviews?.map(i => i.id) || [];
    const currentInterviewIds = completedInterviews.map(i => i.id);
    
    // New interviews added
    if (currentInterviewIds.length > existingInterviewIds.length) {
      return true;
    }
    
    // Check for rating changes
    const currentAvgRating = this.calculateAverageRating(completedInterviews);
    const existingAvgRating = parseFloat(existingDraft.content.recommendations?.overallRating || 0);
    
    return Math.abs(currentAvgRating - existingAvgRating) > 0.3; // Significant rating change
  }
  
  /**
   * Determine draft stage based on completion status
   * @param {Array} completedInterviews 
   * @param {Object} sessionData 
   * @returns {string}
   */
  determineStage(completedInterviews, sessionData) {
    const completionPercentage = (completedInterviews.length / sessionData.interviews.length) * 100;
    
    if (completionPercentage < 50) {
      return 'first_draft';
    } else if (completionPercentage < 100) {
      return 'in_progress';
    } else {
      return 'pending_review';
    }
  }
  
  /**
   * Get latest interview completion date
   * @param {Array} completedInterviews 
   * @returns {string}
   */
  getLatestInterviewDate(completedInterviews) {
    const dates = completedInterviews
      .map(i => i.completedAt)
      .filter(date => date)
      .sort((a, b) => new Date(b) - new Date(a));
    
    return dates[0] || new Date().toISOString();
  }
  
  /**
   * Get changes summary between versions
   * @param {Object} existingDraft 
   * @param {Object} newContent 
   * @returns {Object}
   */
  getChangesSummary(existingDraft, newContent) {
    const changes = {
      newInterviews: [],
      ratingChange: null,
      skillsAdded: [],
      strengthsAdded: []
    };
    
    // Detect new interviews
    const existingInterviewIds = existingDraft.content.interviews?.map(i => i.id) || [];
    const newInterviewIds = newContent.interviews?.map(i => i.id) || [];
    changes.newInterviews = newInterviewIds.filter(id => !existingInterviewIds.includes(id));
    
    // Rating changes
    const oldRating = parseFloat(existingDraft.content.recommendations?.overallRating || 0);
    const newRating = parseFloat(newContent.recommendations?.overallRating || 0);
    if (Math.abs(newRating - oldRating) > 0.1) {
      changes.ratingChange = { from: oldRating, to: newRating };
    }
    
    // New skills and strengths
    const oldSkills = existingDraft.content.professional?.skills || [];
    const newSkills = newContent.professional?.skills || [];
    changes.skillsAdded = newSkills.filter(skill => !oldSkills.includes(skill));
    
    const oldStrengths = existingDraft.content.recommendations?.strengths || [];
    const newStrengths = newContent.recommendations?.strengths || [];
    changes.strengthsAdded = newStrengths.filter(strength => !oldStrengths.includes(strength));
    
    return changes;
  }
  
  /**
   * Get interview type progress breakdown
   * @param {Array} completedInterviews 
   * @param {Object} sessionData 
   * @returns {Object}
   */
  getInterviewTypeProgress(completedInterviews, sessionData) {
    const types = ['technical', 'behavioral', 'friend', 'final'];
    const progress = {};
    
    types.forEach(type => {
      const totalOfType = sessionData.interviews.filter(i => i.type === type).length;
      const completedOfType = completedInterviews.filter(i => i.type === type).length;
      
      if (totalOfType > 0) {
        progress[type] = {
          completed: completedOfType,
          total: totalOfType,
          percentage: Math.round((completedOfType / totalOfType) * 100)
        };
      }
    });
    
    return progress;
  }
  
  /**
   * Calculate average rating from interviews
   * @param {Array} interviews 
   * @returns {number}
   */
  calculateAverageRating(interviews) {
    const ratings = interviews
      .map(i => i.content?.rating || i.rating)
      .filter(rating => rating && !isNaN(rating));
    
    if (ratings.length === 0) return 0;
    
    return ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
  }
  
  /**
   * Manually transition draft stage (admin action)
   * @param {string} draftId 
   * @param {string} targetStage 
   * @param {Object} context 
   * @returns {Object} Transition result
   */
  async transitionDraftStage(draftId, targetStage, context = {}) {
    try {
      const { adminUser, reason, rejectionReason } = context;
      
      // In production, this would fetch from database
      // For now, simulate finding a draft
      const mockDraft = {
        id: draftId,
        stage: 'pending_review',
        version: 2,
        interviewCount: 2,
        content: {
          recommendations: {
            overallRating: '4.3'
          }
        },
        history: []
      };
      
      const sessionData = await this.getSessionData('session_001');
      
      // Validate the stage transition
      const validation = stageValidationService.validateTransition(
        mockDraft.stage,
        targetStage,
        {
          draftData: mockDraft,
          sessionData: sessionData,
          isAdminAction: true,
          adminUser: adminUser,
          rejectionReason: rejectionReason,
          reason: reason
        }
      );
      
      if (!validation.valid) {
        return {
          success: false,
          message: `Stage transition failed: ${validation.reason}`,
          validation: validation
        };
      }
      
      // Create transition history
      const transitionHistory = stageValidationService.createTransitionHistory(
        mockDraft.stage,
        targetStage,
        {
          adminUser: adminUser,
          reason: reason || rejectionReason || `Manual stage transition to ${targetStage}`,
          automaticTrigger: false
        }
      );
      
      // Update draft (in production, this would be database update)
      const updatedDraft = {
        ...mockDraft,
        stage: targetStage,
        updatedAt: new Date().toISOString(),
        reviewedBy: targetStage === 'under_review' ? adminUser?.id : mockDraft.reviewedBy,
        approvedBy: targetStage === 'approved' ? adminUser?.id : mockDraft.approvedBy,
        rejectionReason: targetStage === 'rejected' ? rejectionReason : mockDraft.rejectionReason,
        stageMetadata: stageValidationService.getStageMetadata(targetStage),
        availableTransitions: stageValidationService.getAvailableTransitions(targetStage, {
          draftData: mockDraft,
          sessionData: sessionData
        }),
        history: [
          ...mockDraft.history,
          {
            id: uuidv4(),
            action: 'manual_stage_transition',
            fromStage: mockDraft.stage,
            toStage: targetStage,
            timestamp: new Date().toISOString(),
            triggeredBy: adminUser?.id || 'unknown',
            adminUser: adminUser,
            reason: reason || rejectionReason,
            stageTransition: transitionHistory,
            validationResult: validation
          }
        ]
      };
      
      console.log(`✅ Manual stage transition: ${mockDraft.stage} → ${targetStage} by ${adminUser?.name}`);
      
      return {
        success: true,
        message: `Draft stage successfully changed from ${mockDraft.stage} to ${targetStage}`,
        draft: updatedDraft,
        transition: transitionHistory,
        validation: validation
      };
      
    } catch (error) {
      console.error('Error in manual stage transition:', error);
      return {
        success: false,
        message: 'Error during stage transition',
        error: error.message
      };
    }
  }
  
  /**
   * Get draft history with enhanced filtering
   * @param {string} draftId 
   * @param {Object} filters 
   * @returns {Object} Filtered history
   */
  async getDraftHistory(draftId, filters = {}) {
    try {
      // In production, this would fetch from database
      const mockHistory = [
        {
          id: uuidv4(),
          action: 'created',
          stage: 'first_draft',
          version: 1,
          timestamp: '2025-01-25T10:00:00Z',
          triggeredBy: 'system',
          details: 'Auto-created from 1 completed interview(s)'
        },
        {
          id: uuidv4(),
          action: 'version_updated',
          fromStage: 'first_draft',
          toStage: 'in_progress',
          version: 2,
          timestamp: '2025-01-25T15:00:00Z',
          triggeredBy: 'system',
          details: 'Auto-updated to v2 with 2/3 interviews completed'
        }
      ];
      
      let filteredHistory = [...mockHistory];
      
      // Apply filters
      if (filters.action) {
        filteredHistory = filteredHistory.filter(h => h.action === filters.action);
      }
      
      if (filters.triggeredBy) {
        filteredHistory = filteredHistory.filter(h => h.triggeredBy === filters.triggeredBy);
      }
      
      if (filters.fromDate) {
        filteredHistory = filteredHistory.filter(h => 
          new Date(h.timestamp) >= new Date(filters.fromDate)
        );
      }
      
      if (filters.toDate) {
        filteredHistory = filteredHistory.filter(h => 
          new Date(h.timestamp) <= new Date(filters.toDate)
        );
      }
      
      // Sort by timestamp (newest first)
      filteredHistory.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
      return {
        success: true,
        history: filteredHistory,
        total: filteredHistory.length,
        filters: filters
      };
      
    } catch (error) {
      console.error('Error fetching draft history:', error);
      return {
        success: false,
        message: 'Error fetching draft history',
        error: error.message
      };
    }
  }
}

// Export singleton instance
module.exports = new DraftService();
