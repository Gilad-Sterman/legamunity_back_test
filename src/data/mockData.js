// Shared mock data for all controllers
// This prevents circular dependency issues between controllers

// Mock data for sessions - will be replaced with Supabase later
const mockSessions = [
  {
    id: 'session_001',
    // Client Details
    client_name: 'Abraham Cohen',
    client_age: 78,
    client_contact: {
      phone: '+972-50-123-4567',
      email: 'abraham.cohen@example.com',
      address: '15 Rothschild Blvd, Tel Aviv, Israel'
    },
    family_contact_details: {
      primary_contact: {
        name: 'Sarah Cohen-Levy',
        relationship: 'daughter',
        phone: '+972-54-987-6543',
        email: 'sarah.levy@example.com'
      },
      emergency_contact: {
        name: 'David Cohen',
        relationship: 'son',
        phone: '+972-52-456-7890',
        email: 'david.cohen@example.com'
      }
    },
    preferred_language: 'hebrew',
    special_requirements: 'Hearing aid user, prefers morning sessions',
    accessibility_needs: ['hearing_assistance', 'large_text_display'],
    
    // Session Configuration
    session_type: 'Life Story Creation',
    priority_level: 'standard',
    estimated_duration: '4-6 weeks',
    preferred_schedule: {
      days: ['sunday', 'tuesday', 'thursday'],
      times: ['09:00-12:00'],
      timezone: 'Asia/Jerusalem'
    },
    
    // Story Preferences
    story_preferences: {
      focus_areas: ['childhood', 'family', 'career', 'immigration_story'],
      tone_preference: 'nostalgic',
      special_topics_include: ['Holocaust survival', 'Building family business', 'Community involvement'],
      special_topics_exclude: ['Political controversies'],
      target_length: 'comprehensive',
      include_photos: true,
      family_tree_integration: true
    },
    
    // Session Status and Progress
    status: 'in_progress',
    progress: {
      interviews_completed: 1,
      total_interviews: 5,
      completion_percentage: 20,
      estimated_completion_date: '2024-02-26'
    },
    
    // Timestamps
    createdAt: '2024-01-10T08:00:00Z',
    updatedAt: '2024-01-15T11:05:00Z',
    
    // Interviews Array
    interviews: [
      {
        id: 'int_001',
        name: '1',
        type: 'life_story',
        status: 'completed',
        duration: 90,
        file_upload: null,
        notes: 'Initial life story interview completed successfully',
        isFriendInterview: false
      },
      {
        id: 'int_002',
        name: '2',
        type: 'life_story',
        status: 'pending',
        duration: 90,
        file_upload: null,
        notes: '',
        isFriendInterview: false
      },
      {
        id: 'int_003',
        name: '3',
        type: 'life_story',
        status: 'pending',
        duration: 90,
        file_upload: null,
        notes: '',
        isFriendInterview: false
      },
      {
        id: 'int_004',
        name: '4',
        type: 'life_story',
        status: 'pending',
        duration: 90,
        file_upload: null,
        notes: '',
        isFriendInterview: false
      },
      {
        id: 'int_005',
        name: '5',
        type: 'life_story',
        status: 'pending',
        duration: 90,
        file_upload: null,
        notes: '',
        isFriendInterview: false
      }
    ],
    
    metadata: {
      totalDuration: 450,
      completedInterviews: 1,
      estimatedCompletionDate: '2024-02-26',
      priority: 'standard',
      story_completion_percentage: 20
    }
  },
  {
    id: 'session_002',
    // Client Details
    client_name: 'Miriam Goldstein',
    client_age: 85,
    client_contact: {
      phone: '+972-52-234-5678',
      email: 'miriam.goldstein@example.com',
      address: '8 Ben Yehuda St, Jerusalem, Israel'
    },
    family_contact_details: {
      primary_contact: {
        name: 'Rachel Goldstein-Bar',
        relationship: 'daughter',
        phone: '+972-54-876-5432',
        email: 'rachel.bar@example.com'
      }
    },
    preferred_language: 'hebrew',
    special_requirements: 'Wheelchair accessible location required',
    accessibility_needs: ['wheelchair_access', 'large_text_display'],
    
    // Session Configuration
    session_type: 'Life Story Creation',
    priority_level: 'urgent',
    estimated_duration: '3-4 weeks',
    
    // Story Preferences
    story_preferences: {
      focus_areas: ['childhood', 'family', 'community_work'],
      tone_preference: 'warm',
      special_topics_include: ['Teaching career', 'Community leadership'],
      special_topics_exclude: [],
      target_length: 'medium',
      include_photos: true,
      family_tree_integration: false
    },
    
    // Session Status and Progress
    status: 'pending',
    progress: {
      interviews_completed: 0,
      total_interviews: 5,
      completion_percentage: 0,
      estimated_completion_date: '2024-02-15'
    },
    
    // Timestamps
    createdAt: '2024-01-12T10:00:00Z',
    updatedAt: '2024-01-12T10:00:00Z',
    
    // Interviews Array
    interviews: [
      {
        id: 'interview_002_1',
        name: '1',
        type: 'life_story',
        status: 'pending',
        duration: 90,
        file_upload: null,
        notes: '',
        isFriendInterview: true
      },
      {
        id: 'interview_002_2',
        name: '2',
        type: 'life_story',
        status: 'pending',
        duration: 90,
        file_upload: null,
        notes: '',
        isFriendInterview: false
      },
      {
        id: 'interview_002_3',
        name: '3',
        type: 'life_story',
        status: 'pending',
        duration: 90,
        file_upload: null,
        notes: '',
        isFriendInterview: false
      },
      {
        id: 'interview_002_4',
        name: '4',
        type: 'life_story',
        status: 'pending',
        duration: 90,
        file_upload: null,
        notes: '',
        isFriendInterview: false
      },
      {
        id: 'interview_002_5',
        name: '5',
        type: 'life_story',
        status: 'pending',
        duration: 90,
        file_upload: null,
        notes: '',
        isFriendInterview: false
      }
    ],
    
    metadata: {
      totalDuration: 450,
      completedInterviews: 0,
      estimatedCompletionDate: '2024-02-15',
      priority: 'urgent',
      story_completion_percentage: 0
    }
  }
];

// Mock data for standalone interviews (separate from session interviews)
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

module.exports = {
  mockSessions,
  mockInterviews
};
