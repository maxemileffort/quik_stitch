import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { corsHeaders } from '../_shared/cors.ts'; // Assuming shared CORS headers

// OpenAI API details
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const OPENAI_API_URL = 'https://api.openai.com/v1/audio/transcriptions';

// Interface for the expected webhook payload (adjust if your webhook sends differently)
interface TranscriptionRequestPayload {
  type: 'INSERT';
  table: 'transcription_requests';
  record: {
    id: string;
    video_id: string;
    user_id: string;
    audio_storage_path: string;
    status: string;
  };
  schema: 'public'; // Or your schema name
  old_record: null | any;
}

// Interface for OpenAI verbose JSON response (adjust based on actual response)
interface OpenAICaptionSegment {
  id: number;
  seek: number;
  start: number; // Start time in seconds
  end: number;   // End time in seconds
  text: string;
  tokens: number[];
  temperature: number;
  avg_logprob: number;
  compression_ratio: number;
  no_speech_prob: number;
}

interface OpenAIVerboseResponse {
  text: string; // Full transcription text
  language: string;
  duration: number;
  segments: OpenAICaptionSegment[];
}


// Function to create Supabase client with Service Role Key
function getSupabaseServiceRoleClient(): SupabaseClient {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase URL or Service Role Key environment variables');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      // Prevent client from persisting session
      persistSession: false,
      // Bypass RLS by using the Service Role key
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

// --- Main Function Logic ---
serve(async (req) => {
  // 1. Handle CORS preflight (optional for webhooks, but good practice)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // 2. Check required environment variables
  if (!OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY environment variable not set.');
    return new Response(JSON.stringify({ error: 'Server configuration error: Missing OpenAI API key.' }), { status: 500 });
  }
  // Service role client creation checks its own env vars

  let requestRecord: TranscriptionRequestPayload['record'] | null = null;
  let supabaseAdmin: SupabaseClient | null = null;

  try {
    // 3. Parse webhook payload
    const payload: TranscriptionRequestPayload = await req.json();
    if (payload.type !== 'INSERT' || payload.table !== 'transcription_requests' || !payload.record) {
      console.warn('Received non-insert or invalid payload:', payload);
      return new Response(JSON.stringify({ message: 'Ignoring non-insert event or invalid payload' }), { status: 200 });
    }
    requestRecord = payload.record;
    console.log(`Processing request ID: ${requestRecord.id}`);

    // 4. Get Supabase Service Role Client
    supabaseAdmin = getSupabaseServiceRoleClient();

    // 5. Update request status to 'processing'
    const { error: updateError } = await supabaseAdmin
      .from('transcription_requests')
      .update({ status: 'processing', updated_at: new Date().toISOString() })
      .eq('id', requestRecord.id);

    if (updateError) {
      throw new Error(`Failed to update request status to processing: ${updateError.message}`);
    }

    // 6. Download audio file from Storage
    console.log(`Downloading audio from: ${requestRecord.audio_storage_path}`);
    const { data: blobData, error: downloadError } = await supabaseAdmin.storage
      .from('audio_uploads') // Use the correct bucket name
      .download(requestRecord.audio_storage_path);

    if (downloadError || !blobData) {
      throw new Error(`Failed to download audio file: ${downloadError?.message || 'Blob data is null'}`);
    }
    console.log(`Audio downloaded successfully (${blobData.size} bytes).`);

    // 7. Call OpenAI Whisper API
    const formData = new FormData();
    formData.append('file', blobData, 'audio.aac'); // Filename is required, extension matters
    formData.append('model', 'whisper-1');
    // Request verbose JSON for timestamps
    formData.append('response_format', 'verbose_json');
    formData.append('timestamp_granularities[]', 'segment'); // Get segment-level timestamps

    console.log('Sending audio to OpenAI Whisper API...');
    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` },
      body: formData,
    });

    console.log(`OpenAI API response status: ${response.status}`);
    const responseData = await response.json();

    if (!response.ok) {
      // OpenAI API Error
      const errorMessage = responseData.error?.message || 'Failed to transcribe audio.';
      console.error('OpenAI API Error:', responseData);
      throw new Error(`OpenAI API Error (${response.status}): ${errorMessage}`);
    }

    // 8. Process successful transcription
    console.log('Transcription successful.');
    const transcriptionResult = responseData as OpenAIVerboseResponse;

    // 9. Insert captions into the 'captions' table
    if (transcriptionResult.segments && transcriptionResult.segments.length > 0) {
      const captionInserts = transcriptionResult.segments.map(segment => ({
        video_id: requestRecord!.video_id, // Use non-null assertion as record is checked
        start_time: segment.start,
        end_time: segment.end,
        text: segment.text.trim(),
        source: 'ai', // Mark as AI-generated
      }));

      console.log(`Inserting ${captionInserts.length} caption segments...`);
      const { error: captionInsertError } = await supabaseAdmin
        .from('captions')
        .insert(captionInserts);

      if (captionInsertError) {
        // Log error but maybe don't fail the whole process? Or mark request as partially failed?
        console.error(`Failed to insert captions: ${captionInsertError.message}`);
        // Decide how to handle partial failure - here we'll still mark request completed but log error
        await supabaseAdmin
          .from('transcription_requests')
          .update({
            status: 'completed_with_errors',
            result: transcriptionResult, // Store full result anyway
            error_message: `Failed to insert captions: ${captionInsertError.message}`,
            updated_at: new Date().toISOString()
          })
          .eq('id', requestRecord!.id);
        // Return success as the transcription itself worked
         return new Response(JSON.stringify({ message: 'Transcription complete, but caption insert failed.' }), { status: 200 });
      }
      console.log('Captions inserted successfully.');
    } else {
      console.log('No caption segments found in OpenAI response.');
      // Optionally update request status differently if no segments?
    }

    // 10. Update request status to 'completed'
    const { error: finalUpdateError } = await supabaseAdmin
      .from('transcription_requests')
      .update({
        status: 'completed',
        result: transcriptionResult, // Store the full result
        error_message: null, // Clear any previous error
        updated_at: new Date().toISOString()
      })
      .eq('id', requestRecord!.id);

    if (finalUpdateError) {
      // This is problematic - transcription done, captions inserted, but status not updated
      console.error(`CRITICAL: Failed to update request status to completed: ${finalUpdateError.message}`);
      // Consider alerting mechanism here
      return new Response(JSON.stringify({ error: 'Failed to finalize request status after completion.' }), { status: 500 });
    }

    console.log(`Request ${requestRecord!.id} completed successfully.`);
    return new Response(JSON.stringify({ message: 'Transcription processed successfully.' }), { status: 200 });

  } catch (error) {
    console.error(`Error processing transcription request ${requestRecord?.id || 'unknown'}:`, error);

    // Attempt to update the request status to 'failed' if possible
    if (requestRecord && supabaseAdmin) {
      try {
        await supabaseAdmin
          .from('transcription_requests')
          .update({
            status: 'failed',
            error_message: error.message,
            updated_at: new Date().toISOString()
          })
          .eq('id', requestRecord.id);
      } catch (updateErr) {
        console.error(`Failed to update request status to failed: ${updateErr.message}`);
      }
    }

    // Return error response
    return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
