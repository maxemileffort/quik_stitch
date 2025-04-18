// Import only the auth verification client
const { supabaseAuthVerify } = require('../services/supabaseClient');
const prisma = require('../services/prismaClient'); // Import Prisma client

const authenticateUser = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
  }

  const token = authHeader.split(' ')[1];

  try {
    // Use the specific auth verification client
    const { data: { user }, error } = await supabaseAuthVerify.auth.getUser(token);

    if (error || !user) {
      console.error('Token validation error:', error);
      // Log the specific error for debugging, but return a generic message
      return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
    }

    // Normalize email to lowercase for consistent matching
    const normalizedEmail = user.email?.toLowerCase();
    if (!normalizedEmail) {
        // Should not happen if Supabase user exists, but good practice
        return res.status(400).json({ error: 'User email not found in token' });
    }

    // User is authenticated with Supabase, now ensure they exist in our public.User table
    console.log(`Upserting user based on Supabase Auth ID: ${user.id} (Email: ${normalizedEmail})`); // Log based on UUID
    const appUser = await prisma.user.upsert({
        where: { id: user.id }, // Use Supabase Auth UUID for lookup
        update: {
            // Update email and name if needed
            email: normalizedEmail,
            name: user.user_metadata?.full_name || null,
        },
        create: {
            id: user.id, // Use Supabase Auth UUID as the primary key on create
            email: normalizedEmail,
            name: user.user_metadata?.full_name || null,
            // isPaidUser defaults to false
        },
    });

    // --- Add Detailed Logging ---
    if (!appUser) {
        console.error(`!!! Middleware Error: Prisma upsert failed to return a user for email: ${normalizedEmail}`);
        // Stop processing if we couldn't get a valid app user
        return res.status(500).json({ error: 'Failed to retrieve user data after authentication.' });
    } else {
        // Log the ID that will be attached to req.user
        console.log(`>>> Middleware Success: Attaching appUser with ID: ${appUser.id} (Email: ${appUser.email}) to req.user`);
    }
    // --- End Detailed Logging ---

    // Attach the user record from *our* database (public.User) to the request object
    // This ensures downstream routes have access to the correct CUID (appUser.id)
    req.user = appUser;

    next(); // Proceed to the next middleware or route handler
  } catch (error) {
    console.error('Authentication middleware error (incl. upsert):', error);
    res.status(500).json({ error: 'Internal server error during authentication' });
  }
};

module.exports = authenticateUser;
