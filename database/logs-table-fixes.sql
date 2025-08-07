-- Fix existing logs table for proper logging functionality
-- Run this in Supabase SQL Editor to fix the issues

-- 1. Change interview_id column from UUID to VARCHAR to handle custom interview IDs
ALTER TABLE logs ALTER COLUMN interview_id TYPE VARCHAR(255);

-- 2. Drop the existing RLS policy and create a new one that allows service role inserts
DROP POLICY IF EXISTS "Authenticated users can insert logs" ON logs;

-- 3. Create new policy that allows both service role and authenticated users to insert
CREATE POLICY "Service and authenticated users can insert logs" ON logs
    FOR INSERT WITH CHECK (
        auth.role() = 'service_role' OR 
        auth.role() = 'authenticated'
    );

-- 4. Verify the changes
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'logs' 
AND column_name IN ('interview_id', 'user_id', 'session_id');

-- 5. Test insert (this should work now)
INSERT INTO logs (event_type, event_action, user_email, interview_id, event_data, severity) 
VALUES ('test', 'test_insert', 'test@example.com', 'interview_test_123', '{"test": true}', 'info');

-- 6. Clean up test record
DELETE FROM logs WHERE event_type = 'test' AND event_action = 'test_insert';
