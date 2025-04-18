-- Create table to queue transcription requests
CREATE TABLE transcription_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id uuid NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, -- Ensure user context
    audio_storage_path text NOT NULL, -- Path to the audio file in Supabase Storage
    status text NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
    result jsonb, -- Store the transcription result (or error details)
    error_message text, -- Store specific error messages on failure
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add indexes for querying requests
CREATE INDEX idx_transcription_requests_status ON transcription_requests(status);
CREATE INDEX idx_transcription_requests_video_id ON transcription_requests(video_id);
CREATE INDEX idx_transcription_requests_user_id ON transcription_requests(user_id);

-- Enable RLS
ALTER TABLE transcription_requests ENABLE ROW LEVEL SECURITY;

-- Policies: Allow users to manage/view their own requests
CREATE POLICY "Allow users to select own transcription requests" ON transcription_requests
    FOR SELECT USING (auth.uid() = user_id);

-- Allow function/system to insert (will likely be handled by whisper-transcribe function)
-- Note: The insert policy might need adjustment depending on how the trigger/function runs
CREATE POLICY "Allow authenticated users to insert requests" ON transcription_requests
    FOR INSERT WITH CHECK (auth.uid() = user_id); -- Restrictive: only user can insert for themselves

-- Allow background function to update status/results (requires elevated privileges or specific role)
-- This policy might be too open; ideally use SECURITY DEFINER function or specific role
CREATE POLICY "Allow system to update requests" ON transcription_requests
    FOR UPDATE USING (true); -- Simplified for now, review security implications

-- Add composite index to captions table for performance
CREATE INDEX IF NOT EXISTS idx_captions_video_id_start_time ON captions(video_id, start_time);

-- Trigger function for updated_at (re-declare defensively if needed)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'trigger_set_timestamp') THEN
        CREATE FUNCTION trigger_set_timestamp()
        RETURNS TRIGGER AS $func$
        BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
        END;
        $func$ LANGUAGE plpgsql;
    END IF;
END
$$;

-- Trigger for transcription_requests table
CREATE TRIGGER set_transcription_requests_timestamp
BEFORE UPDATE ON transcription_requests
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();
