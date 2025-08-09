// Mock data for drafts - in production this would come from a database
const mockDrafts = [
  {
    id: 'draft-001',
    sessionId: 'session-001',
    userId: 'user-001',
    title: 'Software Engineer Assessment - John Doe',
    content: {
      personal: {
        name: 'John Doe',
        experience: '5 years',
        education: 'Computer Science, MIT'
      },
      professional: {
        skills: ['JavaScript', 'React', 'Node.js'],
        achievements: ['Led team of 4 developers', 'Reduced load time by 40%']
      },
      recommendations: {
        strengths: ['Strong technical skills', 'Good communication'],
        improvements: ['Could improve system design knowledge'],
        decision: 'Recommend for hire'
      }
    },
    stage: 'under_review',
    version: 1,
    progress: {
      completion: 85,
      sections: {
        personal: 100,
        professional: 90,
        recommendations: 65
      }
    },
    user: {
      uid: 'user-001',
      displayName: 'John Doe',
      email: 'john.doe@example.com'
    },
    session: {
      id: 'session-001',
      title: 'Software Engineer Position'
    },
    interviewCount: 2,
    createdAt: '2025-01-20T10:00:00Z',
    updatedAt: '2025-01-25T14:30:00Z',
    reviewedBy: null,
    approvedBy: null,
    rejectionReason: null
  },
  {
    id: 'draft-002',
    sessionId: 'session-002',
    userId: 'user-002',
    title: 'Product Manager Assessment - Jane Smith',
    content: {
      personal: {
        name: 'Jane Smith',
        experience: '8 years',
        education: 'MBA, Stanford'
      },
      professional: {
        skills: ['Product Strategy', 'Data Analysis', 'Team Leadership'],
        achievements: ['Launched 3 successful products', 'Increased user engagement by 60%']
      },
      recommendations: {
        strengths: ['Excellent strategic thinking', 'Strong leadership'],
        improvements: ['Technical knowledge could be deeper'],
        decision: 'Strong recommend for hire'
      }
    },
    stage: 'approved',
    version: 2,
    progress: {
      completion: 100,
      sections: {
        personal: 100,
        professional: 100,
        recommendations: 100
      }
    },
    user: {
      uid: 'user-002',
      displayName: 'Jane Smith',
      email: 'jane.smith@example.com'
    },
    session: {
      id: 'session-002',
      title: 'Product Manager Position'
    },
    interviewCount: 3,
    createdAt: '2025-01-18T09:00:00Z',
    updatedAt: '2025-01-26T16:45:00Z',
    reviewedBy: 'admin-001',
    approvedBy: 'admin-001',
    rejectionReason: null
  },
  {
    id: 'draft-003',
    sessionId: 'session-003',
    userId: 'user-003',
    title: 'Data Scientist Assessment - Mike Johnson',
    content: {
      personal: {
        name: 'Mike Johnson',
        experience: '3 years',
        education: 'PhD Statistics, UC Berkeley'
      },
      professional: {
        skills: ['Python', 'Machine Learning', 'SQL'],
        achievements: ['Published 5 research papers', 'Built ML pipeline processing 1M+ records']
      },
      recommendations: {
        strengths: ['Strong analytical skills', 'Research background'],
        improvements: ['Needs more industry experience'],
        decision: 'Conditional hire - junior level'
      }
    },
    stage: 'first_draft',
    version: 1,
    progress: {
      completion: 45,
      sections: {
        personal: 80,
        professional: 60,
        recommendations: 20
      }
    },
    user: {
      uid: 'user-003',
      displayName: 'Mike Johnson',
      email: 'mike.johnson@example.com'
    },
    session: {
      id: 'session-003',
      title: 'Data Scientist Position'
    },
    interviewCount: 1,
    createdAt: '2025-01-26T11:00:00Z',
    updatedAt: '2025-01-26T11:30:00Z',
    reviewedBy: null,
    approvedBy: null,
    rejectionReason: null
  },
  {
    id: 'draft-004',
    sessionId: 'session-004',
    userId: 'user-004',
    title: 'UX Designer Assessment - Sarah Wilson',
    content: {
      personal: {
        name: 'Sarah Wilson',
        experience: '6 years',
        education: 'Design, Art Center'
      },
      professional: {
        skills: ['Figma', 'User Research', 'Prototyping'],
        achievements: ['Redesigned mobile app with 25% conversion increase', 'Led design system implementation']
      },
      recommendations: {
        strengths: ['Excellent design portfolio', 'User-centered approach'],
        improvements: ['Could strengthen technical collaboration skills'],
        decision: 'Recommend for hire'
      }
    },
    stage: 'pending_approval',
    version: 1,
    progress: {
      completion: 95,
      sections: {
        personal: 100,
        professional: 95,
        recommendations: 90
      }
    },
    user: {
      uid: 'user-004',
      displayName: 'Sarah Wilson',
      email: 'sarah.wilson@example.com'
    },
    session: {
      id: 'session-004',
      title: 'UX Designer Position'
    },
    interviewCount: 2,
    createdAt: '2025-01-22T14:00:00Z',
    updatedAt: '2025-01-26T10:15:00Z',
    reviewedBy: 'admin-001',
    approvedBy: null,
    rejectionReason: null
  },
  {
    id: 'draft-005',
    sessionId: 'session-005',
    userId: 'user-005',
    title: 'Marketing Manager Assessment - David Brown',
    content: {
      personal: {
        name: 'David Brown',
        experience: '4 years',
        education: 'Marketing, NYU'
      },
      professional: {
        skills: ['Digital Marketing', 'Analytics', 'Campaign Management'],
        achievements: ['Increased ROI by 150%', 'Managed $2M annual budget']
      },
      recommendations: {
        strengths: ['Data-driven approach', 'Creative campaigns'],
        improvements: ['Limited B2B experience', 'Needs stronger presentation skills'],
        decision: 'Not recommended - skill gaps too significant'
      }
    },
    stage: 'rejected',
    version: 1,
    progress: {
      completion: 100,
      sections: {
        personal: 100,
        professional: 100,
        recommendations: 100
      }
    },
    user: {
      uid: 'user-005',
      displayName: 'David Brown',
      email: 'david.brown@example.com'
    },
    session: {
      id: 'session-005',
      title: 'Marketing Manager Position'
    },
    interviewCount: 2,
    createdAt: '2025-01-19T13:00:00Z',
    updatedAt: '2025-01-24T09:20:00Z',
    reviewedBy: 'admin-001',
    approvedBy: null,
    rejectionReason: 'Significant skill gaps in required areas. Candidate lacks B2B experience and presentation skills needed for senior role.'
  }
];

/**
 * @desc    Get all drafts with filtering and pagination
 * @route   GET /api/admin/drafts
 * @access  Admin
 */
exports.getAllDrafts = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      stage = 'all',
      search = '',
      sortBy = 'updatedAt',
      sortOrder = 'desc',
      progress = 'all',
      startDate,
      endDate
    } = req.query;

    let filteredDrafts = [...mockDrafts];

    // Filter by stage
    if (stage !== 'all') {
      filteredDrafts = filteredDrafts.filter(draft => draft.stage === stage);
    }

    // Filter by search
    if (search) {
      const searchLower = search.toLowerCase();
      filteredDrafts = filteredDrafts.filter(draft => 
        draft.title.toLowerCase().includes(searchLower) ||
        draft.user.displayName.toLowerCase().includes(searchLower) ||
        draft.session.title.toLowerCase().includes(searchLower)
      );
    }

    // Filter by progress
    if (progress !== 'all') {
      filteredDrafts = filteredDrafts.filter(draft => {
        const completion = draft.progress.completion;
        switch (progress) {
          case 'low':
            return completion <= 30;
          case 'medium':
            return completion > 30 && completion <= 70;
          case 'high':
            return completion > 70;
          default:
            return true;
        }
      });
    }

    // Filter by date range
    if (startDate || endDate) {
      filteredDrafts = filteredDrafts.filter(draft => {
        const draftDate = new Date(draft.updatedAt);
        if (startDate && draftDate < new Date(startDate)) return false;
        if (endDate && draftDate > new Date(endDate)) return false;
        return true;
      });
    }

    // Sort drafts
    filteredDrafts.sort((a, b) => {
      let aValue, bValue;
      
      switch (sortBy) {
        case 'createdAt':
          aValue = new Date(a.createdAt);
          bValue = new Date(b.createdAt);
          break;
        case 'updatedAt':
          aValue = new Date(a.updatedAt);
          bValue = new Date(b.updatedAt);
          break;
        case 'progress':
          aValue = a.progress.completion;
          bValue = b.progress.completion;
          break;
        case 'stage':
          aValue = a.stage;
          bValue = b.stage;
          break;
        case 'title':
          aValue = a.title;
          bValue = b.title;
          break;
        default:
          aValue = new Date(a.updatedAt);
          bValue = new Date(b.updatedAt);
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    // Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedDrafts = filteredDrafts.slice(startIndex, endIndex);

    const totalPages = Math.ceil(filteredDrafts.length / limit);

    res.status(200).json({
      success: true,
      data: paginatedDrafts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: filteredDrafts.length,
        totalPages
      }
    });
  } catch (error) {
    console.error('Error fetching drafts:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching drafts',
      error: error.message
    });
  }
};

/**
 * @desc    Get draft by ID
 * @route   GET /api/admin/drafts/:id
 * @access  Admin
 */
exports.getDraftById = async (req, res) => {
  try {
    const { id } = req.params;
    const draft = mockDrafts.find(d => d.id === id);

    if (!draft) {
      return res.status(404).json({
        success: false,
        message: 'Draft not found'
      });
    }

    res.status(200).json({
      success: true,
      data: draft
    });
  } catch (error) {
    console.error('Error fetching draft:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching draft',
      error: error.message
    });
  }
};

/**
 * @desc    Update draft content
 * @route   PUT /api/admin/drafts/:id
 * @access  Admin
 */
exports.updateDraftContent = async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;

    const draftIndex = mockDrafts.findIndex(d => d.id === id);
    if (draftIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Draft not found'
      });
    }

    // Update the draft
    mockDrafts[draftIndex] = {
      ...mockDrafts[draftIndex],
      content: { ...mockDrafts[draftIndex].content, ...content },
      updatedAt: new Date().toISOString(),
      version: mockDrafts[draftIndex].version + 1
    };

    res.status(200).json({
      success: true,
      data: mockDrafts[draftIndex],
      message: 'Draft updated successfully'
    });
  } catch (error) {
    console.error('Error updating draft:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating draft',
      error: error.message
    });
  }
};

/**
 * @desc    Update draft stage
 * @route   PUT /api/admin/drafts/:id/stage
 * @access  Admin
 */
exports.updateDraftStage = async (req, res) => {
  try {
    const { id } = req.params;
    const { stage, reason } = req.body;

    const draftIndex = mockDrafts.findIndex(d => d.id === id);
    if (draftIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Draft not found'
      });
    }

    const validStages = ['first_draft', 'under_review', 'pending_approval', 'approved', 'rejected'];
    if (!validStages.includes(stage)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid stage'
      });
    }

    // Update the draft stage
    const updates = {
      stage,
      updatedAt: new Date().toISOString()
    };

    if (stage === 'rejected' && reason) {
      updates.rejectionReason = reason;
    }

    if (stage === 'approved') {
      updates.approvedBy = 'admin-001'; // Mock admin ID for testing
    }

    if (stage === 'under_review') {
      updates.reviewedBy = 'admin-001'; // Mock admin ID for testing
    }

    mockDrafts[draftIndex] = {
      ...mockDrafts[draftIndex],
      ...updates
    };

    res.status(200).json({
      success: true,
      data: mockDrafts[draftIndex],
      message: `Draft ${stage.replace('_', ' ')} successfully`
    });
  } catch (error) {
    console.error('Error updating draft stage:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating draft stage',
      error: error.message
    });
  }
};

/**
 * @desc    Export draft
 * @route   POST /api/admin/drafts/:id/export
 * @access  Admin
 */
exports.exportDraft = async (req, res) => {
  try {
    const { id } = req.params;
    const { format } = req.body;

    const draft = mockDrafts.find(d => d.id === id);
    if (!draft) {
      return res.status(404).json({
        success: false,
        message: 'Draft not found'
      });
    }

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="draft-${id}.json"`);
      res.status(200).json(draft);
    } else if (format === 'pdf') {
      // In a real implementation, you would generate a PDF here
      // For now, we'll return a mock response
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="draft-${id}.pdf"`);
      res.status(200).send('Mock PDF content - implement PDF generation here');
    } else {
      res.status(400).json({
        success: false,
        message: 'Invalid export format. Use "json" or "pdf"'
      });
    }
  } catch (error) {
    console.error('Error exporting draft:', error);
    res.status(500).json({
      success: false,
      message: 'Error exporting draft',
      error: error.message
    });
  }
};

/**
 * @desc    Get draft history
 * @route   GET /api/admin/drafts/:id/history
 * @access  Admin
 */
exports.getDraftHistory = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Mock history data - in production this would come from a database
    const mockHistory = [
      {
        id: 'history-001',
        draftId: id,
        action: 'created',
        timestamp: '2025-01-20T10:00:00Z',
        userId: 'system',
        changes: 'Draft created from interview data'
      },
      {
        id: 'history-002',
        draftId: id,
        action: 'content_updated',
        timestamp: '2025-01-22T14:30:00Z',
        userId: 'admin-001',
        changes: 'Updated professional section with additional skills'
      },
      {
        id: 'history-003',
        draftId: id,
        action: 'stage_changed',
        timestamp: '2025-01-25T14:30:00Z',
        userId: 'admin-001',
        changes: 'Changed stage from first_draft to under_review'
      }
    ];

    res.status(200).json({
      success: true,
      data: mockHistory
    });
  } catch (error) {
    console.error('Error fetching draft history:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching draft history',
      error: error.message
    });
  }
};

/**
 * @desc    Get all drafts for a specific session
 * @route   GET /api/sessions-supabase/:id/drafts
 * @access  Admin
 */
const getDraftsBySession = async (req, res) => {
  try {
    const { id: sessionId } = req.params; // Note: using 'id' to match the route pattern /:id/drafts
    
    // Use the existing supabaseService to get drafts from the database
    const supabaseService = require('../services/supabaseService');
    const result = await supabaseService.getDraftsBySession(sessionId);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.error || 'Failed to fetch drafts'
      });
    }

    res.status(200).json({
      success: true,
      data: result.data,
      count: result.data.length,
      message: `Found ${result.data.length} draft(s) for session ${sessionId}`
    });

  } catch (error) {
    console.error('Error fetching drafts by session:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching drafts by session',
      error: error.message
    });
  }
};

// Export the getDraftsBySession function
exports.getDraftsBySession = getDraftsBySession;
