const express = require('express');
const router = express.Router();
const prisma = require('../services/prismaClient');
const authenticateUser = require('../middleware/authenticateUser');
const authorizeAdmin = require('../middleware/authorizeAdmin');

// --- Middleware for all admin routes ---
// Ensure user is authenticated AND is an admin
router.use(authenticateUser);
router.use(authorizeAdmin);

// --- Admin Routes ---

// GET /api/admin/stats - Fetch usage statistics
router.get('/stats', async (req, res) => {
  try {
    // --- User Stats ---
    const totalUsers = await prisma.user.count();
    const newUsersLast7Days = await prisma.user.count({
      where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
    });
    const activeSubscriptions = await prisma.user.count({
      where: { subscriptionStatus: 'active' },
    });
    // Note: Calculating churn accurately often requires more complex logic
    // (e.g., tracking subscription start/end dates over time).
    // This is a simplified placeholder.
    const recentlyCancelled = await prisma.user.count({
        where: {
            subscriptionStatus: { in: ['canceled', 'past_due'] }, // Consider both
            updatedAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Example: in last 30 days
        }
    });


    // --- Job Stats ---
    const totalJobs = await prisma.job.count();
    const jobsLast7Days = await prisma.job.count({
        where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
    });
    const jobsByType = await prisma.job.groupBy({
      by: ['type'],
      _count: {
        id: true,
      },
    });
    const jobsByStatus = await prisma.job.groupBy({
        by: ['status'],
        _count: {
            id: true,
        }
    })

    // --- Login Stats (Placeholder - Requires Login Tracking) ---
    // This requires explicitly tracking login events, which isn't in the current schema.
    // You would need a separate table or logging mechanism.
    const loginsLast7Days = 'N/A - Login tracking not implemented';

    // Format stats for response
    const stats = {
      users: {
        total: totalUsers,
        newLast7Days: newUsersLast7Days,
        activeSubscriptions: activeSubscriptions,
        churnLast30Days: recentlyCancelled, // Simplified churn metric
      },
      jobs: {
        total: totalJobs,
        last7Days: jobsLast7Days,
        byType: jobsByType.reduce((acc, item) => {
          acc[item.type] = item._count.id;
          return acc;
        }, {}),
        byStatus: jobsByStatus.reduce((acc, item) => {
            acc[item.status] = item._count.id;
            return acc;
        }, {}),
      },
      logins: {
        last7Days: loginsLast7Days,
      },
    };

    res.json(stats);
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    res.status(500).json({ error: 'Failed to fetch admin statistics' });
  }
});

// GET /api/admin/users - Fetch a list of all users
router.get('/users', async (req, res) => {
    // Add pagination later if needed
    try {
        const users = await prisma.user.findMany({
            select: { // Select only necessary fields to avoid exposing sensitive data unintentionally
                id: true,
                email: true,
                name: true,
                isPaidUser: true,
                isAdmin: true,
                subscriptionStatus: true,
                createdAt: true,
                updatedAt: true,
            },
            orderBy: {
                createdAt: 'desc', // Show newest users first
            },
        });
        res.json(users);
    } catch (error) {
        console.error('Error fetching users for admin:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// Future Enhancements (Tracked in frontend/TODO.md):
// - Add routes for updating user details (e.g., PUT /users/:id to toggle isAdmin)
// - Add routes for deleting users (e.g., DELETE /users/:id) - Use with caution!

module.exports = router;
