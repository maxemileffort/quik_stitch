const express = require('express');
// Import BOTH clients - Admin for logout, AuthVerify for magic link
const { supabaseAdmin, supabaseAuthVerify } = require('../services/supabaseClient');
const prisma = require('../services/prismaClient'); // Import Prisma client
const authenticateUser = require('../middleware/authenticateUser'); // Import the middleware
// Environment variables are now loaded centrally in server.js

const router = express.Router();

// POST /auth/magic-link - Request a magic link
router.post('/magic-link', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Missing required field: email' });
  }

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173'; // Default if not set

  try {
    // Use the AuthVerify client (Anon Key) for signInWithOtp
    // Use only the base frontend URL for redirection
    console.log(`Attempting signInWithOtp for ${email} with redirect to base URL: ${frontendUrl}`);
    const { error } = await supabaseAuthVerify.auth.signInWithOtp({
      email: email,
      options: {
        // Redirect to the base frontend URL; frontend routing handles the rest
        emailRedirectTo: frontendUrl,
      },
    });

    if (error) {
      // Log the full error object from Supabase for more details
      console.error("Supabase signInWithOtp Error:", JSON.stringify(error, null, 2));
      return res.status(500).json({ error: `Failed to request magic link: ${error.message || 'Unknown Supabase error'}` });
    }

    res.json({ message: 'Magic link sent! Check your email.' });
  } catch (catchError) {
    // Log the error caught by the try...catch block
    console.error("Caught error in /magic-link route:", catchError);
    res.status(500).json({ error: 'Internal server error requesting magic link' });
  }
});

// POST /auth/logout - Logout the user (requires valid session/token)
// The /verify endpoint is removed as verification and user upsert
// are now handled client-side (session detection) and in authenticateUser middleware (upsert).
router.post('/logout', async (req, res) => {
  // Note: Supabase client SDK handles token internally for signOut if initialized correctly.
  // If you are passing the token explicitly, ensure it's done securely.
  // For simplicity, assuming the client handles the session context.
  try {
    // Use the admin client for sign out initiated by the backend
    const { error } = await supabaseAdmin.auth.signOut();

    if (error) {
      console.error("Error logging out:", error);
      return res.status(500).json({ error: `Failed to logout: ${error.message}` });
    }

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error("Error logging out:", error);
    res.status(500).json({ error: 'Internal server error during logout' });
  }
});

// GET /auth/me - Get the currently authenticated user's details
router.get('/me', authenticateUser, (req, res) => {
  // The authenticateUser middleware already verified the token and attached the user object
  // We include isAdmin field for frontend context
  const { id, email, name, isPaidUser, isAdmin } = req.user; // Add isAdmin here
  res.json({ user: { id, email, name, isPaidUser, isAdmin } }); // Add isAdmin to the response
});

module.exports = router;
