const { PrismaClient } = require('@prisma/client');
const { exec } = require('child_process'); // Still needed for ffmpeg
const path = require('path'); // Still needed for basename, join

// Import Services
const prisma = require('./services/prismaClient'); // Assuming prismaClient is also in services
const fileSystemService = require('./services/fileSystemService');
const storageService = require('./services/storageService');
const functionService = require('./services/functionService');

const POLLING_INTERVAL_MS = 5000;
const MAX_CONCURRENT_JOBS = 1;
let processingCount = 0;

console.log('Worker started. Polling interval:', POLLING_INTERVAL_MS, 'ms');

/**
 * Executes the ffmpeg stitching command.
 * @param {string} jobId - The ID of the job for logging.
 * @param {string[]} localInputPaths - Array of local paths to the input video files.
 * @param {string} tempDir - The temporary directory for this job.
 * @returns {Promise<string>} - The local path to the stitched output file.
 */
async function runFfmpegStitch(jobId, localInputPaths, tempDir) {
  const outputFileName = `output-${jobId}.mp4`;
  const localOutputPath = path.join(tempDir, outputFileName);
  console.log(`[${jobId}] Starting ffmpeg stitching process... Output: ${localOutputPath}`);

  // Create a file list for ffmpeg concat demuxer
  const fileListContent = localInputPaths.map(p => `file '${p.replace(/\\/g, '/')}'`).join('\n');
  const fileListPath = path.join(tempDir, 'filelist.txt');
  // Use fileSystemService to write the file list
  await fileSystemService.writeLocalFile(fileListPath, Buffer.from(fileListContent));

  // ffmpeg command using concat demuxer
  const ffmpegCommand = `ffmpeg -f concat -safe 0 -i "${fileListPath}" -c copy "${localOutputPath}"`;

  await new Promise((resolve, reject) => {
    exec(ffmpegCommand, (error, stdout, stderr) => {
      if (error) {
        console.error(`[${jobId}] ffmpeg error: ${stderr}`);
        return reject(new Error(`ffmpeg execution failed: ${stderr || error.message}`));
      }
      console.log(`[${jobId}] ffmpeg output: ${stdout}`);
      resolve(stdout);
    });
  });
  console.log(`[${jobId}] ffmpeg stitching process completed.`);
  return localOutputPath;
}

/**
 * Processes a single job based on its type.
 * @param {import('@prisma/client').Job} job - The job object from the database.
 */
async function processJob(job) {
  console.log(`[${job.id}] Processing job... Type: ${job.type}`);
  processingCount++;
  let tempDir = null; // Keep track of tempDir for cleanup

  try {
    // 1. Update status to PROCESSING
    await prisma.job.update({
      where: { id: job.id },
      data: { status: 'PROCESSING' },
    });

    // 2. Parse input files
    let storageInputPaths = [];
    if (job.inputFile) {
      try {
        storageInputPaths = JSON.parse(job.inputFile);
        if (!Array.isArray(storageInputPaths) || storageInputPaths.length === 0) {
          throw new Error('Invalid or empty input file array.');
        }
      } catch (e) {
        throw new Error(`Failed to parse inputFile JSON: ${e.message}`);
      }
    } else {
      throw new Error('No input files specified for the job.');
    }

    // 3. Create temp directory and download files
    tempDir = await fileSystemService.createTempDir(job.id);
    console.log(`[${job.id}] Downloading ${storageInputPaths.length} file(s)...`);
    const downloadPromises = storageInputPaths.map(storagePath =>
      storageService.downloadFile(storagePath, tempDir)
    );
    const localInputPaths = await Promise.all(downloadPromises);
    console.log(`[${job.id}] All files downloaded to temp directory.`);

    let jobResultOutput = null; // This will hold the final output (path or text)

    // 4. Execute core job logic based on type
    if (job.type === 'STITCHING') {
      const localOutputPath = await runFfmpegStitch(job.id, localInputPaths, tempDir);

      // 5. Upload stitched output
      const outputStoragePath = `user-${job.userId}/outputs/${path.basename(localOutputPath)}`;
      await storageService.uploadFile(localOutputPath, outputStoragePath);
      jobResultOutput = outputStoragePath; // Store the storage path as the result

    } else if (job.type === 'TRANSCRIPTION') {
      if (storageInputPaths.length === 0) {
        throw new Error('No input file found for transcription.');
      }
      const inputStoragePath = storageInputPaths[0]; // Use the first input file's storage path
      jobResultOutput = await functionService.invokeTranscriptionFunction(inputStoragePath); // Store transcription text as the result
    } else {
        throw new Error(`Unsupported job type: ${job.type}`);
    }

    // 6. Update job status to COMPLETED
    await prisma.job.update({
      where: { id: job.id },
      data: { status: 'COMPLETED', outputFile: jobResultOutput },
    });
    console.log(`[${job.id}] Job completed successfully.`);

  } catch (error) {
    console.error(`[${job.id}] Error processing job:`, error);
    // Update job status to FAILED and store the error message
    await prisma.job.update({
      where: { id: job.id },
      data: {
        status: 'FAILED',
        errorMessage: error.message || 'Unknown error during processing',
      },
    });
  } finally {
    processingCount--;
    // Clean up temp directory if it was created
    if (tempDir) {
      await fileSystemService.cleanupTempDir(job.id);
    }
  }
}

// --- Polling and Shutdown Logic (Remains largely the same) ---

async function pollForJobs() {
  if (processingCount >= MAX_CONCURRENT_JOBS) {
    return;
  }
  try {
    const job = await prisma.job.findFirst({
      where: { status: 'QUEUED' },
      orderBy: { createdAt: 'asc' },
    });

    if (job) {
      console.log(`Found queued job: ${job.id}`);
      processJob(job).catch(err => {
         console.error(`[${job?.id || 'unknown'}] Unhandled error in processJob execution:`, err);
         if (job) processingCount--; // Ensure count is decremented on unexpected error
      });
    }
  } catch (error) {
    console.error('Error polling for jobs:', error);
  }
}

const intervalId = setInterval(pollForJobs, POLLING_INTERVAL_MS);

process.on('SIGINT', async () => {
  console.log('Worker shutting down...');
  clearInterval(intervalId);

  console.log('Requeuing any jobs currently in processing state...');
  try {
    const { count } = await prisma.job.updateMany({
      where: { status: 'PROCESSING' },
      data: { status: 'QUEUED' },
    });
    if (count > 0) {
      console.log(`Requeued ${count} processing job(s).`);
    } else {
      console.log('No jobs were processing.');
    }
  } catch (error) {
    console.error('Error requeuing jobs during shutdown:', error);
  }

  await prisma.$disconnect();
  console.log('Prisma Client disconnected. Worker exited.');
  process.exit(0);
});
