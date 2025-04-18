// Standard CORS headers for Supabase Edge Functions
// Allows requests from localhost for development and Vercel/Netlify previews
// IMPORTANT: Update 'YOUR_PROD_DOMAIN' to your actual production domain(s)
// e.g., 'https://www.quikstitch.app, https://quikstitch.app'

const allowedOrigins = [
  'http://localhost:5173', // Default Vite dev port
  'http://localhost:3000', // Common dev port
  'https://*.vercel.app',  // Allow Vercel previews
  // Add your production domain(s) here:
  // 'https://YOUR_PROD_DOMAIN.com', 
];

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // Or restrict in production: check origin header
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS', // Allow POST for sending data, OPTIONS for preflight
};

// Optional: Function to dynamically check origin in production
/*
export function getAllowedOrigin(requestHeaders: Headers): string | null {
  const origin = requestHeaders.get('origin');
  if (!origin) return null;

  // Simple wildcard matching for Vercel previews
  if (/https://.*\.vercel\.app$/.test(origin)) {
    return origin;
  }

  if (allowedOrigins.includes(origin)) {
    return origin;
  }

  return null; // Origin not allowed
}

// Example usage in function:
// const origin = getAllowedOrigin(req.headers);
// if (!origin && Deno.env.get('ENVIRONMENT') === 'production') { /* handle blocked origin * / }
// const headers = { ...corsHeaders, 'Access-Control-Allow-Origin': origin || '*' };
*/
