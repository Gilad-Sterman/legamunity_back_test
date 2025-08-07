-- Fix RLS policy for logs table - more permissive approach
-- Run this in Supabase SQL Editor

-- Option 1: Temporarily disable RLS for logs table (simplest fix)
ALTER TABLE logs DISABLE ROW LEVEL SECURITY;

-- Option 2: If you want to keep RLS enabled, use this more permissive policy instead
-- (Comment out the line above and uncomment the lines below)

/*
-- Drop all existing policies
DROP POLICY IF EXISTS "Users can view own logs" ON logs;
DROP POLICY IF EXISTS "Service and authenticated users can insert logs" ON logs;
DROP POLICY IF EXISTS "Authenticated users can insert logs" ON logs;
DROP POLICY IF EXISTS "No updates allowed" ON logs;
DROP POLICY IF EXISTS "No deletes allowed" ON logs;

-- Create a very permissive insert policy for backend operations
CREATE POLICY "Allow all inserts for logging" ON logs
    FOR INSERT WITH CHECK (true);

-- Keep the view policy restrictive
CREATE POLICY "Users can view own logs" ON logs
    FOR SELECT USING (
        auth.uid() = user_id OR 
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE auth.users.id = auth.uid() 
            AND auth.users.raw_user_meta_data->>'role' = 'admin'
        )
    );

-- Keep the no-update/delete policies
CREATE POLICY "No updates allowed" ON logs FOR UPDATE USING (false);
CREATE POLICY "No deletes allowed" ON logs FOR DELETE USING (false);
*/

-- Test the fix
INSERT INTO logs (event_type, event_action, user_email, interview_id, event_data, severity) 
VALUES ('test', 'rls_test', 'test@example.com', 'interview_test_456', '{"test": "rls_fix"}', 'info');

-- Verify the insert worked
SELECT * FROM logs WHERE event_action = 'rls_test';

-- Clean up test record
DELETE FROM logs WHERE event_action = 'rls_test';
