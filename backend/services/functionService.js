const supabase = require('./supabaseClient'); // Assuming supabaseClient is in the same services directory

const TRANSCRIPTION_FUNCTION_NAME = 'whisper-transcribe';

/**
 * Invokes the Supabase transcription function.
 * @param {string} storagePath - The storage path of the file to transcribe.
 * @returns {Promise<string>} - The transcription text.
 * @throws {Error} If the function fails or returns invalid data.
 */
async function invokeTranscriptionFunction(storagePath) {
  console.log(`Invoking Supabase function '${TRANSCRIPTION_FUNCTION_NAME}' for path: ${storagePath}`);

  const { data: functionData, error: functionError } = await supabase.functions.invoke(
    TRANSCRIPTION_FUNCTION_NAME,
    { body: { storagePath: storagePath } } // Pass storage path in the body
  );

  if (functionError) {
    throw new Error(`Supabase function '${TRANSCRIPTION_FUNCTION_NAME}' failed: ${functionError.message}`);
  }

  // Assuming the function returns { transcription: "..." } or similar
  if (!functionData || typeof functionData.transcription !== 'string') {
    console.error(`Unexpected response from ${TRANSCRIPTION_FUNCTION_NAME}:`, functionData);
    throw new Error(`Invalid or missing transcription data from Supabase function '${TRANSCRIPTION_FUNCTION_NAME}'.`);
  }

  console.log(`Transcription received successfully from function.`);
  return functionData.transcription;
}

module.exports = {
  invokeTranscriptionFunction
};
