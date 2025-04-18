const authorizeAdmin = (req, res, next) => {
  // Assumes authenticateUser middleware has run and attached the user object
  if (!req.user) {
    console.error('Authorization Error: req.user not found. Ensure authenticateUser runs first.');
    return res.status(401).json({ error: 'Unauthorized: User not authenticated' });
  }

  if (!req.user.isAdmin) {
    console.warn(`Authorization Denied: User ${req.user.id} (${req.user.email}) attempted to access admin route without admin privileges.`);
    return res.status(403).json({ error: 'Forbidden: Admin access required' });
  }

  // User is authenticated and is an admin
  console.log(`Authorization Granted: Admin user ${req.user.id} (${req.user.email}) accessed admin route.`);
  next();
};

module.exports = authorizeAdmin;
