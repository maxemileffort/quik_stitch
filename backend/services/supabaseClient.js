const { createClient } = require('@supabase/supabase-js');
// Environment variables are now loaded centrally in server.js

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY; // Needed for auth validation client
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Needed for admin tasks

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
  throw new Error('Supabase URL, Anon Key, and Service Role Key must be provided in environment variables (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY)');
}

// Client for administrative tasks (worker, etc.) - USES SERVICE ROLE KEY
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    // Explicitly disable auto-refreshing tokens for service role client
    // as it doesn't represent a user session.
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false
  }
});

// Client specifically for validating user tokens (middleware) - USES ANON KEY
// This ensures auth validation behaves consistently with the frontend.
console.log(`Initializing supabaseAuthVerify client with URL: ${supabaseUrl}`); // Log the URL being used
console.log(`Using Anon Key starting with: ${supabaseAnonKey?.substring(0, 5)}...`); // Log start of Anon Key
const supabaseAuthVerify = createClient(supabaseUrl, supabaseAnonKey);


module.exports = {
  supabaseAdmin,        // Use this for backend tasks needing admin rights (e.g., worker uploads)
  supabaseAuthVerify    // Use this specifically for validating tokens in middleware
};
