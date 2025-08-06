-- Initial Schema for Legamunity PoC

-- Users Table: Stores information about the end-users (interviewees)
CREATE TABLE IF NOT EXISTS Users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name VARCHAR(255) NOT NULL,
    phone_number VARCHAR(20) UNIQUE NOT NULL,
    id_number VARCHAR(20) UNIQUE,
    date_of_birth DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sessions Table: Represents a full interview process for a user, which can have multiple interviews (e.g., main, friend)
CREATE TABLE IF NOT EXISTS Sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES Users(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'Pending' NOT NULL, -- e.g., Pending, Active, Completed, In Review
    scheduled_time TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Interviews Table: Stores details for each specific interview event
CREATE TABLE IF NOT EXISTS Interviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES Sessions(id) ON DELETE CASCADE,
    interview_type VARCHAR(50) NOT NULL, -- e.g., 'Main', 'Friend'
    status VARCHAR(50) DEFAULT 'Scheduled' NOT NULL, -- e.g., Scheduled, In Progress, Completed, Failed
    cqs_score NUMERIC(3, 2),
    wer_score NUMERIC(3, 2),
    duration_seconds INT,
    transcript TEXT,
    audio_file_url VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Drafts Table: Manages the review process for an interview transcript
CREATE TABLE IF NOT EXISTS Drafts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    interview_id UUID REFERENCES Interviews(id) ON DELETE CASCADE,
    version INT NOT NULL DEFAULT 1,
    status VARCHAR(50) DEFAULT 'Internal Review' NOT NULL, -- e.g., Internal Review, Client Review, Final Approval
    content JSONB, -- Stores the structured story content
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(interview_id, version)
);

-- Conflicts Table: Tracks detected conflicts within a draft
CREATE TABLE IF NOT EXISTS Conflicts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    draft_id UUID REFERENCES Drafts(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'Open' NOT NULL, -- e.g., Open, Resolved
    resolution_type VARCHAR(50), -- e.g., A, B, Merge
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
