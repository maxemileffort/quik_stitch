-- Create the projects table
CREATE TABLE projects (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL, -- Allow anonymous projects initially? Or ON DELETE CASCADE?
    name text,
    status text NOT NULL DEFAULT 'pending', -- e.g., 'pending', 'uploading', 'processing', 'completed', 'failed'
    final_video_url text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add indexes for common queries
CREATE INDEX idx_projects_user_id ON projects(user_id);
CREATE INDEX idx_projects_status ON projects(status);

-- Enable Row Level Security (RLS)
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Policies for projects (adjust based on your auth rules)
-- Allow users to see their own projects
CREATE POLICY "Allow users to select own projects" ON projects
    FOR SELECT USING (auth.uid() = user_id);

-- Allow users to insert their own projects
CREATE POLICY "Allow users to insert own projects" ON projects
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Allow users to update their own projects
CREATE POLICY "Allow users to update own projects" ON projects
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Allow users to delete their own projects (consider if needed)
CREATE POLICY "Allow users to delete own projects" ON projects
    FOR DELETE USING (auth.uid() = user_id);


-- Create the videos table
CREATE TABLE videos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL, -- Link to user for easier RLS, cascade delete handled by project
    original_filename text NOT NULL,
    storage_path text NOT NULL, -- Path/URL to the video file in S3
    "order" integer NOT NULL, -- Use quotes as "order" is a reserved keyword
    duration real, -- Duration in seconds (float)
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Add indexes
CREATE INDEX idx_videos_project_id ON videos(project_id);
CREATE INDEX idx_videos_user_id ON videos(user_id);

-- Enable RLS
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;

-- Policies for videos (users can manage videos within their own projects)
CREATE POLICY "Allow users to select videos for own projects" ON videos
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM projects WHERE projects.id = videos.project_id AND projects.user_id = auth.uid()
    ));

CREATE POLICY "Allow users to insert videos for own projects" ON videos
    FOR INSERT WITH CHECK (EXISTS (
        SELECT 1 FROM projects WHERE projects.id = videos.project_id AND projects.user_id = auth.uid()
    ));

CREATE POLICY "Allow users to update videos for own projects" ON videos
    FOR UPDATE USING (EXISTS (
        SELECT 1 FROM projects WHERE projects.id = videos.project_id AND projects.user_id = auth.uid()
    )) WITH CHECK (EXISTS (
        SELECT 1 FROM projects WHERE projects.id = videos.project_id AND projects.user_id = auth.uid()
    ));

CREATE POLICY "Allow users to delete videos for own projects" ON videos
    FOR DELETE USING (EXISTS (
        SELECT 1 FROM projects WHERE projects.id = videos.project_id AND projects.user_id = auth.uid()
    ));


-- Create the captions table
CREATE TABLE captions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id uuid NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    start_time real NOT NULL, -- Start time in seconds (float)
    end_time real NOT NULL,   -- End time in seconds (float)
    text text NOT NULL,
    source text NOT NULL DEFAULT 'ai', -- 'ai' or 'manual'
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Add indexes
CREATE INDEX idx_captions_video_id ON captions(video_id);

-- Enable RLS
ALTER TABLE captions ENABLE ROW LEVEL SECURITY;

-- Policies for captions (users can manage captions for videos within their own projects)
CREATE POLICY "Allow users to select captions for own videos" ON captions
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM videos v JOIN projects p ON v.project_id = p.id
        WHERE v.id = captions.video_id AND p.user_id = auth.uid()
    ));

CREATE POLICY "Allow users to insert captions for own videos" ON captions
    FOR INSERT WITH CHECK (EXISTS (
        SELECT 1 FROM videos v JOIN projects p ON v.project_id = p.id
        WHERE v.id = captions.video_id AND p.user_id = auth.uid()
    ));

CREATE POLICY "Allow users to update captions for own videos" ON captions
    FOR UPDATE USING (EXISTS (
        SELECT 1 FROM videos v JOIN projects p ON v.project_id = p.id
        WHERE v.id = captions.video_id AND p.user_id = auth.uid()
    )) WITH CHECK (EXISTS (
        SELECT 1 FROM videos v JOIN projects p ON v.project_id = p.id
        WHERE v.id = captions.video_id AND p.user_id = auth.uid()
    ));

CREATE POLICY "Allow users to delete captions for own videos" ON captions
    FOR DELETE USING (EXISTS (
        SELECT 1 FROM videos v JOIN projects p ON v.project_id = p.id
        WHERE v.id = captions.video_id AND p.user_id = auth.uid()
    ));

-- Function to automatically update 'updated_at' timestamp
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for projects table
CREATE TRIGGER set_projects_timestamp
BEFORE UPDATE ON projects
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();
