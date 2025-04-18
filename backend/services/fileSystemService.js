const fs = require('fs').promises;
const path = require('path');

const TEMP_BASE_DIR = path.join(__dirname, '..', 'temp'); // Base temp directory outside services

/**
 * Creates a unique temporary directory for a job.
 * @param {string} jobId - The ID of the job.
 * @returns {Promise<string>} - The path to the created temporary directory.
 */
async function createTempDir(jobId) {
  const tempDir = path.join(TEMP_BASE_DIR, jobId);
  await fs.mkdir(tempDir, { recursive: true });
  console.log(`[${jobId}] Created temp directory: ${tempDir}`);
  return tempDir;
}

/**
 * Writes data (Buffer) to a local file path.
 * @param {string} localPath - The full path to the file to write.
 * @param {Buffer} data - The data buffer to write.
 * @returns {Promise<void>}
 */
async function writeLocalFile(localPath, data) {
  await fs.writeFile(localPath, data);
}

/**
 * Reads a local file into a buffer.
 * @param {string} localPath - The full path to the file to read.
 * @returns {Promise<Buffer>} - The file content as a buffer.
 */
async function readLocalFile(localPath) {
    return await fs.readFile(localPath);
}

/**
 * Cleans up (removes) the temporary directory for a job.
 * @param {string} jobId - The ID of the job.
 * @returns {Promise<void>}
 */
async function cleanupTempDir(jobId) {
  const tempDir = path.join(TEMP_BASE_DIR, jobId);
  try {
    await fs.rm(tempDir, { recursive: true, force: true });
    console.log(`[${jobId}] Cleaned up temporary directory: ${tempDir}`);
  } catch (cleanupError) {
    console.error(`[${jobId}] Error cleaning up temp directory ${tempDir}:`, cleanupError);
    // Decide if this error should propagate or just be logged
  }
}

module.exports = {
  createTempDir,
  writeLocalFile,
  readLocalFile,
  cleanupTempDir,
  TEMP_BASE_DIR // Export base dir in case needed elsewhere, though unlikely
};
