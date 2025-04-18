import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { corsHeaders } from '../_shared/cors.ts';

// Function to get Supabase client authorized for the user
function getSupabaseClient(req: Request): SupabaseClient {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    throw new Error('Missing Authorization Header');
  }
  // Create a new client for each request to ensure user context
  return createClient(
    // Get Supabase URL and Anon Key from environment variables
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    // Create client with Auth context of the user that called the function.
    // This way your row-level-security (RLS) policies are applied.
    { global: { headers: { Authorization: authHeader } } }
  );
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Check environment variables
    if (!Deno.env.get('SUPABASE_URL') || !Deno.env.get('SUPABASE_ANON_KEY')) {
      throw new Error('Missing Supabase environment variables');
    }

    // 2. Get Supabase client and user
    const supabase = getSupabaseClient(req);
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error('User auth error:', userError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Get video_id from query parameters
    const url = new URL(req.url);
    const videoId = url.searchParams.get('videoId');
    if (!videoId) {
      return new Response(JSON.stringify({ error: 'Missing videoId query parameter' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 4. Get audio blob
    const audioBlob = await req.blob();
    if (!audioBlob || audioBlob.size === 0) {
      return new Response(JSON.stringify({ error: 'No audio data received.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 5. Upload audio to Supabase Storage
    // Use a unique path, e.g., user_id/video_id/timestamp.aac
    const timestamp = Date.now();
    const storagePath = `${user.id}/${videoId}/${timestamp}.aac`; // Assuming AAC format
    const { data: storageData, error: storageError } = await supabase.storage
      .from('audio_uploads') // Ensure this bucket exists and function has permission
      .upload(storagePath, audioBlob, {
        contentType: audioBlob.type || 'audio/aac', // Use blob type or default
        upsert: false, // Don't overwrite existing files
      });

    if (storageError) {
      console.error('Storage upload error:', storageError);
      throw new Error(`Failed to upload audio: ${storageError.message}`);
    }
    console.log('Audio uploaded to:', storageData.path);

    // 6. Insert request into transcription_requests table
    const { data: requestData, error: insertError } = await supabase
      .from('transcription_requests')
      .insert({
        video_id: videoId,
        user_id: user.id,
        audio_storage_path: storageData.path, // Use the path returned by storage
        status: 'pending',
      })
      .select('id') // Select the ID of the newly created request
      .single(); // Expect only one row back

    if (insertError) {
      console.error('Database insert error:', insertError);
      // Attempt to delete the uploaded file if DB insert fails
      await supabase.storage.from('audio_uploads').remove([storageData.path]);
      throw new Error(`Failed to create transcription request: ${insertError.message}`);
    }

    console.log('Transcription request created:', requestData.id);

    // 7. Return success response with the request ID
    return new Response(JSON.stringify({ requestId: requestData.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 202, // Accepted for processing
    });

  } catch (error) {
    console.error('Error processing request:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
