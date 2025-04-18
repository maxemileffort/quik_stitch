-- Create the profiles table to store user-specific data
CREATE TABLE profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE, -- Link to auth.users table
    updated_at timestamptz,
    username text UNIQUE,
    full_name text,
    avatar_url text,
    website text,
    is_paid_user boolean NOT NULL DEFAULT false -- Add the payment status column
);

-- Add constraints for username format (optional but recommended)
ALTER TABLE profiles
    ADD CONSTRAINT username_length CHECK (char_length(username) >= 3);

-- Set up Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Allow users to view their own profile
CREATE POLICY "Users can view their own profile." ON profiles
    FOR SELECT USING (auth.uid() = id);

-- Policy: Allow users to update their own profile
CREATE POLICY "Users can update their own profile." ON profiles
    FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Function to automatically update 'updated_at' timestamp (if not already created)
-- Check if the function exists before creating it to avoid errors if run multiple times
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

-- Trigger for profiles table to update 'updated_at'
CREATE TRIGGER set_profiles_timestamp
BEFORE UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();


-- Optional: Function to automatically create a profile when a new user signs up
-- This requires the 'supabase_auth_admin' role to bypass RLS temporarily
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER -- Important: Run with the privileges of the definer (supabase_auth_admin)
SET search_path = public
AS $$
begin
  insert into public.profiles (id, username, is_paid_user) -- Default is_paid_user to false
  values (new.id, new.email, false); -- Use email as initial username, or derive differently
  return new;
end;
$$;

-- Trigger to run the function after a new user is inserted into auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
