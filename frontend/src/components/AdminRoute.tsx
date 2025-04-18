import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Loader2 } from 'lucide-react'; // For loading state

const AdminRoute: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) {
    // Show a loading indicator while checking auth status
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!user) {
    // If not logged in at all, redirect to home or login page
    console.log("AdminRoute: No user logged in, redirecting to /");
    return <Navigate to="/" replace />;
  }

  if (!user.isAdmin) {
    // If logged in but not an admin, redirect to the regular dashboard
    console.log(`AdminRoute: User ${user.email} is not an admin, redirecting to /dashboard`);
    return <Navigate to="/dashboard" replace />;
  }

  // If logged in and is an admin, render the child routes
  console.log(`AdminRoute: Admin user ${user.email} accessing route.`);
  return <Outlet />; // Renders the nested child route components
};

export default AdminRoute;
