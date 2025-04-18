const express = require('express');
const prisma = require('../services/prismaClient');
const authenticateUser = require('../middleware/authenticateUser');
// Import the admin client for storage operations needing elevated privileges
const { supabaseAdmin } = require('../services/supabaseClient');
const { BUCKET_NAME } = require('../services/storageService');

const router = express.Router();

// Apply authentication middleware to all routes in this file
router.use(authenticateUser);

// GET /api/jobs - Get all jobs for the authenticated user
router.get('/', async (req, res) => {
  const userId = req.user.id; // Get userId from authenticated user (attached by middleware)

  try {
    const jobs = await prisma.job.findMany({
      where: {
        userId: userId,
      },
      orderBy: {
        createdAt: 'desc', // Show newest jobs first
      },
      // Optionally include related data if needed
      // include: { video: true }
    });
    res.json(jobs);
  } catch (error) {
    console.error(`Error fetching jobs for user ${userId}:`, error);
    res.status(500).json({ error: 'Failed to fetch jobs' });
  }
});

// GET /api/jobs/:id - Get a specific job by ID for the authenticated user
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id; // Get userId from authenticated user

  try {
    const job = await prisma.job.findFirst({
      where: {
        id: id,
        userId: userId, // Ensure the job belongs to the authenticated user
      },
      // Optionally include related data if needed
      // include: { video: true }
    });

    if (!job) {
      // Use 404 Not Found if the job doesn't exist or doesn't belong to the user
      return res.status(404).json({ error: 'Job not found or access denied' });
    }

    res.json(job);
  } catch (error) {
    console.error(`Error fetching job ${id} for user ${userId}:`, error);
    res.status(500).json({ error: 'Failed to fetch job details' });
  }
});


// POST /api/jobs - Create a new job for the authenticated user
router.post('/', async (req, res) => {
  // req.user is now the user record from our public.User table (attached by authenticateUser middleware)
  const appUser = req.user;

  // --- Add Detailed Logging ---
  if (!appUser || !appUser.id) {
      console.error(`!!! Job Route Error: req.user or req.user.id is missing after middleware.`);
      return res.status(500).json({ error: 'User authentication data missing.' });
  }
  console.log(`>>> Job Route: Received request with appUser ID: ${appUser.id} (Email: ${appUser.email})`);
  // --- End Detailed Logging ---

  const { type, inputFile } = req.body;

  // Basic validation
  if (!type) {
    return res.status(400).json({ error: 'Missing required field: type' });
  }

  // Validate job type
  const validTypes = ['STITCHING', 'TRANSCRIPTION']; // Use an array for easier checking
  if (!validTypes.includes(type)) {
    return res.status(400).json({ error: `Invalid job type. Must be one of: ${validTypes.join(', ')}` });
  }

  // Validate inputFile if provided (ensure it's a string, Prisma schema expects String?)
  if (inputFile && typeof inputFile !== 'string') {
      return res.status(400).json({ error: 'Invalid inputFile format. Expected a JSON string.' });
  }

  // Optional: Further validation if inputFile needs to be parsable JSON array
  if (inputFile) {
      try {
          const parsed = JSON.parse(inputFile);
          if (!Array.isArray(parsed)) {
              throw new Error('InputFile must be a JSON array string.');
          }
      } catch (parseError) {
          console.error("Error parsing inputFile JSON:", parseError);
          return res.status(400).json({ error: 'Invalid inputFile format. Failed to parse JSON array string.' });
      }
  } // <-- Add missing closing brace for the if (inputFile) block


  try {
    // User lookup is no longer needed here, as authenticateUser middleware now provides the appUser record.
    // Create the job using the ID (CUID) from the public.User table attached to req.user
    const newJob = await prisma.job.create({
      data: {
        userId: appUser.id, // Use the CUID from the public.User table (req.user.id)
        type: type,
        status: 'QUEUED', // Default status
        // Store the original JSON string (or null) in the database
        inputFile: inputFile || null,
      },
    });
    console.log(`Created new job ${newJob.id} for user ${appUser.id} (Email: ${appUser.email})`);
    // TODO: Trigger background worker here (e.g., add job ID to a queue)
    res.status(201).json(newJob);
  } catch (error) {
    console.error(`Error creating job for user ${appUser.id} (Email: ${appUser.email}):`, error);
    // Simplified error handling for now, can add more specific checks if needed
    res.status(500).json({ error: 'Failed to create job' });
  }
});

// PATCH /api/jobs/:id - Update job status (for the authenticated user)
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const userId = req.user.id; // Get userId from authenticated user

  if (!status) {
    return res.status(400).json({ error: 'Missing required field: status' });
  }

  // Optional: Add validation for allowed status values or transitions
  const allowedStatuses = ['QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED'];
  if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status value. Must be one of: ${allowedStatuses.join(', ')}` });
  }

  try {
    // Use findFirst to check ownership and existence in one query
    const job = await prisma.job.findFirst({
        where: {
            id: id,
            userId: userId, // Ensure the job belongs to the authenticated user
        }
    });

    if (!job) {
      // Job not found OR user doesn't own it
      return res.status(404).json({ error: 'Job not found or you do not have permission to update it' });
    }

    // Now update the job since we know it exists and the user owns it
    const updatedJob = await prisma.job.update({
      where: { id: id },
      data: { status: status },
    });
    console.log(`Updated job ${id} status to ${status} for user ${userId}`);
    res.json(updatedJob);
  } catch (error) {
    console.error(`Error updating job ${id} for user ${userId}:`, error);
    // Handle potential errors during update (e.g., concurrency issues if needed)
    res.status(500).json({ error: 'Failed to update job' });
  }
});

// DELETE /api/jobs/:id - Delete a job (for the authenticated user)
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id; // Get userId from authenticated user

  try {
    // Use findFirst to check ownership and existence
     const job = await prisma.job.findFirst({
        where: {
            id: id,
            userId: userId, // Ensure the job belongs to the authenticated user
        }
    });

    if (!job) {
      // Job not found OR user doesn't own it
      return res.status(404).json({ error: 'Job not found or you do not have permission to delete it' });
    }

    // Now delete the job
    // 1. Delete associated files from Supabase Storage if they exist
    if (job.inputFile) {
        try {
            const filePaths = JSON.parse(job.inputFile);
            if (Array.isArray(filePaths) && filePaths.length > 0) {
                console.log(`Deleting ${filePaths.length} associated files from storage for job ${id}...`);
                // Use supabaseAdmin for storage operations
                const { data: deleteData, error: deleteError } = await supabaseAdmin.storage
                    .from(BUCKET_NAME)
                    .remove(filePaths);

                if (deleteError) {
                    // Log the error but proceed with deleting the job record anyway
                    console.error(`Error deleting files from storage for job ${id}:`, deleteError);
                    // Optionally, you could choose to return an error here and *not* delete the job record
                    // return res.status(500).json({ error: 'Failed to delete associated files from storage.' });
                } else {
                    console.log(`Successfully deleted files from storage for job ${id}.`);
                }
            }
        } catch (parseError) {
            // Log error if inputFile is not valid JSON, but proceed with job deletion
            console.error(`Error parsing inputFile JSON for job ${id} during deletion:`, parseError);
        }
    }

    // 2. Now delete the job record from the database
    await prisma.job.delete({
      where: { id: id },
    });
    console.log(`Deleted job ${id} for user ${userId}`);
    res.status(200).json({ message: 'Job deleted successfully' }); // Send 200 OK on successful deletion
  } catch (error) {
    console.error(`Error deleting job ${id} for user ${userId}:`, error);
    // Handle potential errors during deletion (e.g., Prisma errors)
    res.status(500).json({ error: 'Failed to delete job' });
   }
 });

 // PATCH /api/jobs/:id/captions - Update the captions (outputFile) for a specific job
 router.patch('/:id/captions', async (req, res) => {
   const { id } = req.params;
   const { captions } = req.body; // Expecting the new caption text in req.body.captions
   const userId = req.user.id; // Get userId from authenticated user

   if (captions === undefined || captions === null) {
     return res.status(400).json({ error: 'Missing required field: captions' });
   }

   // Ensure captions is a string (or handle other formats if needed)
   if (typeof captions !== 'string') {
       return res.status(400).json({ error: 'Invalid captions format. Expected a string.' });
   }

   try {
     // 1. Find the job, ensure it belongs to the user and is a TRANSCRIPTION job
     const job = await prisma.job.findFirst({
       where: {
         id: id,
         userId: userId,
       },
     });

     if (!job) {
       return res.status(404).json({ error: 'Job not found or access denied' });
     }

     // 2. Check if the job type allows caption editing (only TRANSCRIPTION for now)
     if (job.type !== 'TRANSCRIPTION') {
         return res.status(400).json({ error: 'Caption editing is only allowed for TRANSCRIPTION jobs.' });
     }

     // 3. Update the outputFile field with the new caption text
     const updatedJob = await prisma.job.update({
       where: { id: id },
       data: { outputFile: captions }, // Update the outputFile field
     });

     console.log(`Updated captions for job ${id} for user ${userId}`);
     res.json(updatedJob); // Return the updated job object

   } catch (error) {
     console.error(`Error updating captions for job ${id} for user ${userId}:`, error);
     res.status(500).json({ error: 'Failed to update captions' });
   }
 });

 module.exports = router;
