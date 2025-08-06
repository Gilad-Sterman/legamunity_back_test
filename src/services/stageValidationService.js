const { v4: uuidv4 } = require('uuid');

/**
 * Stage Validation Service - Handles draft stage transitions and validation
 * Implements business rules for stage progression and admin actions
 */
class StageValidationService {
  
  constructor() {
    // Define valid stage transitions
    this.stageTransitions = {
      'first_draft': ['in_progress', 'under_review'],
      'in_progress': ['pending_review', 'under_review', 'first_draft'], // Can go back to first_draft if interviews removed
      'pending_review': ['under_review', 'approved', 'rejected'],
      'under_review': ['pending_approval', 'rejected', 'in_progress'], // Can go back to in_progress for revisions
      'pending_approval': ['approved', 'rejected', 'under_review'],
      'approved': ['archived'], // Final state, can only be archived
      'rejected': ['in_progress', 'under_review'], // Can be revised
      'archived': [] // Terminal state
    };
    
    // Define which stages require admin action
    this.adminOnlyStages = ['under_review', 'pending_approval', 'approved', 'rejected', 'archived'];
    
    // Define automatic stage transitions (system-triggered)
    this.automaticStages = ['first_draft', 'in_progress', 'pending_review'];
  }
  
  /**
   * Validate if a stage transition is allowed
   * @param {string} currentStage - Current draft stage
   * @param {string} targetStage - Desired target stage
   * @param {Object} context - Additional context (admin action, interview data, etc.)
   * @returns {Object} Validation result
   */
  validateTransition(currentStage, targetStage, context = {}) {
    try {
      // Handle initial draft creation (currentStage is null)
      if (currentStage === null || currentStage === undefined) {
        // For new drafts, only allow automatic stages as initial stages
        if (!this.automaticStages.includes(targetStage)) {
          return {
            valid: false,
            reason: `Invalid initial stage '${targetStage}'. New drafts can only start with: ${this.automaticStages.join(', ')}`,
            allowedInitialStages: this.automaticStages
          };
        }
        
        // Allow creation with automatic stages
        return {
          valid: true,
          message: `New draft can be created with initial stage '${targetStage}'`,
          isInitialCreation: true
        };
      }
      
      // Check if transition is valid for existing drafts
      const allowedTransitions = this.stageTransitions[currentStage] || [];
      
      if (!allowedTransitions.includes(targetStage)) {
        return {
          valid: false,
          reason: `Invalid transition from '${currentStage}' to '${targetStage}'`,
          allowedTransitions: allowedTransitions
        };
      }
      
      // Check admin permission requirements
      if (this.adminOnlyStages.includes(targetStage) && !context.isAdminAction) {
        return {
          valid: false,
          reason: `Stage '${targetStage}' requires admin action`,
          requiresAdmin: true
        };
      }
      
      // Validate business rules for specific transitions
      const businessRuleValidation = this.validateBusinessRules(currentStage, targetStage, context);
      if (!businessRuleValidation.valid) {
        return businessRuleValidation;
      }
      
      return {
        valid: true,
        message: `Transition from '${currentStage}' to '${targetStage}' is valid`,
        requiresAdmin: this.adminOnlyStages.includes(targetStage)
      };
      
    } catch (error) {
      return {
        valid: false,
        reason: `Validation error: ${error.message}`,
        error: error
      };
    }
  }
  
  /**
   * Validate business rules for specific stage transitions
   * @param {string} currentStage 
   * @param {string} targetStage 
   * @param {Object} context 
   * @returns {Object} Validation result
   */
  validateBusinessRules(currentStage, targetStage, context) {
    const { draftData, sessionData, adminUser } = context;
    
    // Rule 1: Can't approve without minimum interview completion
    if (targetStage === 'approved') {
      if (!draftData || !sessionData) {
        return {
          valid: false,
          reason: 'Draft and session data required for approval validation'
        };
      }
      
      const completionPercentage = (draftData.interviewCount / sessionData.interviews.length) * 100;
      if (completionPercentage < 50) {
        return {
          valid: false,
          reason: 'Cannot approve draft with less than 50% interview completion',
          currentCompletion: completionPercentage
        };
      }
      
      // Check for minimum rating
      const overallRating = parseFloat(draftData.content?.recommendations?.overallRating || 0);
      if (overallRating < 2.0) {
        return {
          valid: false,
          reason: 'Cannot approve draft with overall rating below 2.0',
          currentRating: overallRating
        };
      }
    }
    
    // Rule 2: Can't go to pending_review without all interviews completed
    if (targetStage === 'pending_review') {
      if (draftData && sessionData) {
        const completionPercentage = (draftData.interviewCount / sessionData.interviews.length) * 100;
        if (completionPercentage < 100) {
          return {
            valid: false,
            reason: 'Cannot move to pending_review until all interviews are completed',
            currentCompletion: completionPercentage,
            remainingInterviews: sessionData.interviews.length - draftData.interviewCount
          };
        }
      }
    }
    
    // Rule 3: Rejection requires reason
    if (targetStage === 'rejected') {
      if (!context.rejectionReason || context.rejectionReason.trim().length < 10) {
        return {
          valid: false,
          reason: 'Rejection requires a detailed reason (minimum 10 characters)',
          providedReason: context.rejectionReason
        };
      }
    }
    
    // Rule 4: Admin actions require valid admin user
    if (this.adminOnlyStages.includes(targetStage)) {
      if (!adminUser || !adminUser.id) {
        return {
          valid: false,
          reason: 'Admin user information required for this action',
          requiredStage: targetStage
        };
      }
    }
    
    // Rule 5: Can't modify approved or archived drafts
    if (['approved', 'archived'].includes(currentStage) && targetStage !== 'archived') {
      return {
        valid: false,
        reason: `Cannot modify ${currentStage} drafts`,
        finalStage: currentStage
      };
    }
    
    return { valid: true };
  }
  
  /**
   * Get next possible stages for a draft
   * @param {string} currentStage 
   * @param {Object} context 
   * @returns {Array} Available next stages with metadata
   */
  getAvailableTransitions(currentStage, context = {}) {
    const allowedTransitions = this.stageTransitions[currentStage] || [];
    
    return allowedTransitions.map(stage => {
      const validation = this.validateTransition(currentStage, stage, context);
      
      return {
        stage: stage,
        valid: validation.valid,
        requiresAdmin: this.adminOnlyStages.includes(stage),
        automatic: this.automaticStages.includes(stage),
        reason: validation.reason || validation.message,
        metadata: this.getStageMetadata(stage)
      };
    });
  }
  
  /**
   * Get metadata for a specific stage
   * @param {string} stage 
   * @returns {Object} Stage metadata
   */
  getStageMetadata(stage) {
    const metadata = {
      'first_draft': {
        description: 'Initial draft created from first interview(s)',
        color: '#94a3b8',
        icon: 'FileText',
        allowEdit: true,
        allowDelete: true
      },
      'in_progress': {
        description: 'Draft being updated as interviews are completed',
        color: '#3b82f6',
        icon: 'Clock',
        allowEdit: true,
        allowDelete: true
      },
      'pending_review': {
        description: 'All interviews completed, ready for admin review',
        color: '#f59e0b',
        icon: 'AlertCircle',
        allowEdit: false,
        allowDelete: false
      },
      'under_review': {
        description: 'Currently being reviewed by admin',
        color: '#8b5cf6',
        icon: 'Eye',
        allowEdit: false,
        allowDelete: false
      },
      'pending_approval': {
        description: 'Review completed, awaiting final approval',
        color: '#06b6d4',
        icon: 'CheckCircle2',
        allowEdit: false,
        allowDelete: false
      },
      'approved': {
        description: 'Draft approved and finalized',
        color: '#10b981',
        icon: 'CheckCircle',
        allowEdit: false,
        allowDelete: false
      },
      'rejected': {
        description: 'Draft rejected, can be revised',
        color: '#ef4444',
        icon: 'XCircle',
        allowEdit: true,
        allowDelete: true
      },
      'archived': {
        description: 'Draft archived for historical reference',
        color: '#6b7280',
        icon: 'Archive',
        allowEdit: false,
        allowDelete: false
      }
    };
    
    return metadata[stage] || {
      description: 'Unknown stage',
      color: '#6b7280',
      icon: 'HelpCircle',
      allowEdit: false,
      allowDelete: false
    };
  }
  
  /**
   * Create history entry for stage transition
   * @param {string} fromStage 
   * @param {string} toStage 
   * @param {Object} context 
   * @returns {Object} History entry
   */
  createTransitionHistory(fromStage, toStage, context = {}) {
    const { adminUser, reason, automaticTrigger } = context;
    
    return {
      id: uuidv4(),
      action: 'stage_transition',
      fromStage: fromStage,
      toStage: toStage,
      timestamp: new Date().toISOString(),
      triggeredBy: automaticTrigger ? 'system' : (adminUser?.id || 'unknown'),
      adminUser: adminUser ? {
        id: adminUser.id,
        name: adminUser.name || adminUser.displayName,
        email: adminUser.email
      } : null,
      reason: reason || `Stage changed from ${fromStage} to ${toStage}`,
      automatic: !!automaticTrigger,
      metadata: {
        fromStageInfo: this.getStageMetadata(fromStage),
        toStageInfo: this.getStageMetadata(toStage),
        transitionType: automaticTrigger ? 'automatic' : 'manual'
      }
    };
  }
  
  /**
   * Validate if user can perform action on draft in current stage
   * @param {string} stage 
   * @param {string} action 
   * @param {Object} user 
   * @returns {Object} Permission result
   */
  validateUserPermission(stage, action, user = {}) {
    const stageMetadata = this.getStageMetadata(stage);
    const isAdmin = user.role === 'admin' || user.isAdmin;
    
    const permissions = {
      view: true, // Everyone can view
      edit: stageMetadata.allowEdit && (isAdmin || ['first_draft', 'in_progress', 'rejected'].includes(stage)),
      delete: stageMetadata.allowDelete && isAdmin,
      approve: isAdmin && ['pending_review', 'under_review', 'pending_approval'].includes(stage),
      reject: isAdmin && ['pending_review', 'under_review', 'pending_approval'].includes(stage),
      archive: isAdmin && stage === 'approved'
    };
    
    return {
      allowed: permissions[action] || false,
      reason: permissions[action] ? 'Permission granted' : `Action '${action}' not allowed for stage '${stage}' and user role`,
      userRole: isAdmin ? 'admin' : 'user',
      stagePermissions: permissions
    };
  }
}

// Export singleton instance
module.exports = new StageValidationService();
