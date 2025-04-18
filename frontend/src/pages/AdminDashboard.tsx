import React, { useState, useEffect, useCallback } from 'react'; // Add useCallback
import apiClient from '../lib/apiClient';
import { Loader2, AlertCircle, CheckCircle, XCircle, RefreshCw } from 'lucide-react'; // Add icons
import { toast } from 'react-toastify';

// Define interfaces for the expected stats structure
// Keep existing interfaces...

// Define interface for the User object returned by /api/admin/users
interface AdminUser {
    id: string;
    email: string;
    name: string | null;
    isPaidUser: boolean;
    isAdmin: boolean;
    subscriptionStatus: string | null;
    createdAt: string; // Dates will likely be strings
    updatedAt: string;
}

interface UserStats {
  total: number;
  newLast7Days: number;
  activeSubscriptions: number;
  churnLast30Days: number; // Simplified
}

interface JobStats {
  total: number;
  last7Days: number;
  byType: { [key: string]: number }; // e.g., { STITCHING: 10, TRANSCRIPTION: 5 }
  byStatus: { [key: string]: number }; // e.g., { COMPLETED: 12, FAILED: 1 }
}

interface LoginStats {
  last7Days: string | number; // Can be 'N/A' or a number
}

interface AdminStats {
  users: UserStats;
  jobs: JobStats;
  logins: LoginStats;
}

const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]); // State for users
  const [loadingStats, setLoadingStats] = useState<boolean>(true); // Separate loading for stats
  const [loadingUsers, setLoadingUsers] = useState<boolean>(true); // Separate loading for users
  const [statsError, setStatsError] = useState<string | null>(null); // Separate error for stats
  const [usersError, setUsersError] = useState<string | null>(null); // Separate error for users

  // Fetch Stats Function (using useCallback)
  const fetchStats = useCallback(async () => {
      setLoadingStats(true);
      setStatsError(null);
      try {
          const response = await apiClient.get<AdminStats>('/admin/stats');
          setStats(response.data);
      } catch (err: any) {
          console.error("Error fetching admin stats:", err);
          const errorMessage = err.response?.data?.error || 'Failed to load admin statistics.';
          setStatsError(errorMessage);
          toast.error(`Stats Error: ${errorMessage}`);
      } finally {
          setLoadingStats(false);
      }
  }, []); // Empty dependency array means this runs once on mount

  // Fetch Users Function (using useCallback)
  const fetchUsers = useCallback(async () => {
      setLoadingUsers(true);
      setUsersError(null);
      try {
          const response = await apiClient.get<AdminUser[]>('/admin/users');
          setUsers(response.data);
      } catch (err: any) {
          console.error("Error fetching users:", err);
          const errorMessage = err.response?.data?.error || 'Failed to load users.';
          setUsersError(errorMessage);
          toast.error(`Users Error: ${errorMessage}`);
      } finally {
          setLoadingUsers(false);
      }
  }, []); // Empty dependency array

  // Fetch both on component mount
  useEffect(() => {
    fetchStats();
    fetchUsers();
  }, [fetchStats, fetchUsers]); // Include fetch functions in dependency array

  // Combined loading state
  const isLoading = loadingStats || loadingUsers;

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-blue-500" />
        <p className="ml-4 text-lg">Loading Admin Data...</p> {/* Updated loading text */}
      </div>
    );
  }

  // Display errors if any occurred
  if (statsError || usersError) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
        <h1 className="text-2xl font-semibold text-red-600 mb-2">Error Loading Admin Data</h1> {/* Updated error title */}
        {statsError && <p className="text-gray-700 mb-1">Stats Error: {statsError}</p>} {/* Show specific stats error */}
        {usersError && <p className="text-gray-700">Users Error: {usersError}</p>} {/* Show specific users error */}
      </div>
    );
  }

  // Handle case where stats might be missing but users loaded (or vice versa)
  // This check should come *after* the error check.
  if (!stats && !users) { // Check if both are missing (and no errors occurred)
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <p className="text-gray-600">No statistics data available.</p>
      </div>
    );
  }

  // Format Date helper
  const formatDate = (dateString: string | null | undefined): string => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleString();
    } catch (e) {
      console.error("Error formatting date:", dateString, e);
      return 'Invalid Date';
    }
  };

  // Helper to render stat cards
  const StatCard: React.FC<{ title: string; value: string | number; description?: string }> = ({ title, value, description }) => (
    <div className="bg-white shadow rounded-lg p-6">
      <h3 className="text-sm font-medium text-gray-500 truncate">{title}</h3>
      <p className="mt-1 text-3xl font-semibold text-gray-900">{value}</p>
      {description && <p className="text-sm text-gray-500 mt-2">{description}</p>}
    </div>
  );

  // Helper to render grouped stats
  const GroupedStatCard: React.FC<{ title: string; data: { [key: string]: number } }> = ({ title, data }) => (
     <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-700 mb-3">{title}</h3>
        {Object.entries(data).length > 0 ? (
            <ul className="space-y-2">
            {Object.entries(data).map(([key, value]) => (
                <li key={key} className="flex justify-between text-sm">
                <span className="text-gray-600 capitalize">{key.toLowerCase()}</span>
                <span className="font-medium text-gray-800">{value}</span>
                </li>
            ))}
            </ul>
        ) : (
            <p className="text-sm text-gray-500">No data available.</p>
        )}
     </div>
  );


  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Admin Dashboard</h1>

      {/* Statistics Section - Only render if stats are available */}
      {stats && (
        <>
          {/* User Statistics */}
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-700 mb-4">User Statistics</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard title="Total Users" value={stats.users.total} />
              <StatCard title="New Users (Last 7 Days)" value={stats.users.newLast7Days} />
              <StatCard title="Active Subscriptions" value={stats.users.activeSubscriptions} />
              <StatCard title="Churn (Last 30 Days)" value={stats.users.churnLast30Days} description="Cancelled/Past Due" />
            </div>
          </section>

          {/* Job Statistics */}
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-700 mb-4">Job Statistics</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard title="Total Jobs Processed" value={stats.jobs.total} />
              <StatCard title="Jobs (Last 7 Days)" value={stats.jobs.last7Days} />
              <GroupedStatCard title="Jobs by Type" data={stats.jobs.byType} />
              <GroupedStatCard title="Jobs by Status" data={stats.jobs.byStatus} />
            </div>
          </section>

          {/* Login Statistics */}
          <section className="mb-8"> {/* Added mb-8 for spacing */}
            <h2 className="text-xl font-semibold text-gray-700 mb-4">Login Statistics</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard title="Logins (Last 7 Days)" value={stats.logins.last7Days} description="Requires login tracking" />
            </div>
          </section>
        </>
      )}

      {/* Database Management Section */}
      <section className="mt-12">
         <div className="flex justify-between items-center mb-4">
             <h2 className="text-xl font-semibold text-gray-700">User Management</h2>
             <button
                onClick={fetchUsers}
                disabled={loadingUsers}
                className="p-2 rounded-md hover:bg-gray-100 disabled:opacity-50"
                title="Refresh User List"
             >
                <RefreshCw className={`h-5 w-5 text-gray-600 ${loadingUsers ? 'animate-spin' : ''}`} />
             </button>
         </div>
         <div className="bg-white shadow rounded-lg overflow-x-auto">
            {loadingUsers ? (
                <div className="p-6 text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-500 mx-auto" />
                    <p>Loading users...</p>
                </div>
            ) : usersError ? (
                <div className="p-6 text-center text-red-600">
                    <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                    <p>Error loading users: {usersError}</p>
                </div>
            ) : users.length === 0 ? (
                <p className="p-6 text-center text-gray-500">No users found.</p>
            ) : (
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                            <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Paid</th>
                            <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Admin</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sub Status</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created At</th>
                            {/* Actions column placeholder - functionality in TODO.md */}
                            <th scope="col" className="relative px-6 py-3">
                                <span className="sr-only">Actions</span>
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {users.map((user) => (
                            <tr key={user.id}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{user.email}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.name || '-'}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                                    {user.isPaidUser ? <CheckCircle className="h-5 w-5 text-green-500 mx-auto" /> : <XCircle className="h-5 w-5 text-gray-400 mx-auto" />}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                                    {user.isAdmin ? <CheckCircle className="h-5 w-5 text-green-500 mx-auto" /> : <XCircle className="h-5 w-5 text-gray-400 mx-auto" />}
                                    {/* Button to toggle admin status - functionality in TODO.md */}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.subscriptionStatus || 'N/A'}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(user.createdAt)}</td>
                                {/* Actions Cell Placeholder */}
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    {/* Placeholder for Edit/Delete buttons - functionality in TODO.md */}
                                    <span className="text-gray-400">...</span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
         </div>
      </section>
    </div>
  );
};

export default AdminDashboard;
