// Import only the admin client as this service needs elevated privileges
const { supabaseAdmin } = require('./supabaseClient');
const path = require('path');
const fileSystemService = require('./fileSystemService');

const BUCKET_NAME = 'uploads'; // Define bucket name centrally (Changed from 'videos')

/**
 * Downloads a file from Supabase Storage to a local path.
 * @param {string} storagePath - The path of the file in Supabase Storage.
 * @param {string} localDir - The local directory to download the file into.
 * @returns {Promise<string>} - The full local path of the downloaded file.
 * @throws {Error} If download fails or no data is received.
 */
async function downloadFile(storagePath, localDir) {
  const fileName = path.basename(storagePath);
  const localPath = path.join(localDir, fileName);
  console.log(`Downloading ${storagePath} from bucket '${BUCKET_NAME}' to ${localPath}...`);

  // Use supabaseAdmin for storage operations
  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET_NAME)
    .download(storagePath);

  if (error) {
    throw new Error(`Failed to download ${storagePath}: ${error.message}`);
  }
  if (!data) {
    throw new Error(`No data received for ${storagePath}`);
  }

  // Convert Blob to Buffer and write to file using fileSystemService
  const buffer = Buffer.from(await data.arrayBuffer());
  await fileSystemService.writeLocalFile(localPath, buffer);
  console.log(`Successfully downloaded to ${localPath}`);
  return localPath;
}

/**
 * Uploads a local file to Supabase Storage.
 * @param {string} localPath - The full path to the local file to upload.
 * @param {string} storagePath - The destination path in Supabase Storage.
 * @param {number} [maxRetries=3] - Maximum number of retry attempts.
 * @param {number} [retryDelay=1000] - Delay between retries in milliseconds.
 * @returns {Promise<void>}
 * @throws {Error} If upload fails after all retries.
 */
async function uploadFile(localPath, storagePath, maxRetries = 3, retryDelay = 1000) {
  console.log(`Uploading ${localPath} to ${storagePath} in bucket '${BUCKET_NAME}'...`);

  // Read the local file into a buffer using fileSystemService
  const fileBuffer = await fileSystemService.readLocalFile(localPath);

  let attempt = 0;
  while (attempt < maxRetries) {
    attempt++;
    try {
      console.log(`Upload attempt ${attempt}/${maxRetries}...`);
      // Use supabaseAdmin for storage operations
      const { error: uploadError } = await supabaseAdmin.storage
        .from(BUCKET_NAME)
        .upload(storagePath, fileBuffer, {
          contentType: 'video/mp4', // Explicitly set content type for video files
          upsert: true // Overwrite if file already exists
        });

      if (uploadError) {
        // Re-throw non-retryable errors immediately
        throw uploadError;
      }

      // Explicitly log success before returning
      console.log(`Upload call for ${storagePath} completed without throwing error on attempt ${attempt}.`);
      return; // Exit function on success

    } catch (error) {
      console.error(`Upload attempt ${attempt} failed:`, error.message);
      // Check if it's an ECONNRESET error and if retries are left
      const isRetryable = error.message?.includes('ECONNRESET') || error.cause?.code === 'ECONNRESET';
      if (isRetryable && attempt < maxRetries) {
        console.log(`Retryable error detected. Retrying in ${retryDelay / 1000}s...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay)); // Wait before retrying
      } else {
        // If it's not retryable or max retries reached, throw the final error
        throw new Error(`Failed to upload ${localPath} to ${storagePath} after ${attempt} attempts: ${error.message}`);
      }
    }
  }
}

module.exports = {
  downloadFile,
  uploadFile,
  BUCKET_NAME
};
