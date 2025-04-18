// Load environment variables from backend/.env first
require('dotenv').config({ path: require('path').resolve(__dirname, './.env') });

const express = require('express');
const cors = require('cors');
// require('dotenv').config(); // Remove default load

// Import modularized components
const prisma = require('./services/prismaClient'); // Shared Prisma client
const supabase = require('./services/supabaseClient'); // Shared Supabase client (though not directly used here, good practice)
const authenticateUser = require('./middleware/authenticateUser');
const authRoutes = require('./routes/authRoutes');
const jobRoutes = require('./routes/jobRoutes');
const paymentRoutes = require('./routes/paymentRoutes'); // Import payment routes
const adminRoutes = require('./routes/adminRoutes'); // Import admin routes

const app = express();
const port = process.env.PORT || 3001;

// --- Middleware Setup ---

// CORS Configuration
const allowedOrigins = [process.env.FRONTEND_URL || 'http://localhost:5173'];
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  }
};
app.use(cors(corsOptions));
app.use(express.json()); // Middleware to parse JSON bodies

// --- Route Setup ---

// Basic health check / root route
app.get('/', (req, res) => {
  res.send('Hello from QuikStitch Backend!');
});

// Mount authentication routes
app.use('/api/auth', authRoutes);

// Mount job routes (already includes authentication middleware internally)
app.use('/api/jobs', jobRoutes);

// Mount payment routes
// Note: Webhook route within paymentRoutes uses express.raw for body parsing
app.use('/api/payments', paymentRoutes);

// Mount admin routes (includes authentication and admin authorization middleware internally)
app.use('/api/admin', adminRoutes);

// Example route (can be removed or expanded)
app.get('/users', async (req, res) => {
  try {
    // This is just a placeholder - requires a 'User' model in Prisma schema
    // const users = await prisma.user.findMany();
    // res.json(users);
    res.json({ message: "User route placeholder - define User model in schema.prisma if needed" });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});


// --- Server Start ---
app.listen(port, () => {
  console.log(`Backend server listening at http://localhost:${port}`);
});

// Graceful shutdown logic is now handled within prismaClient.js
// No need for additional SIGINT/SIGTERM handlers here unless specific app cleanup is required
