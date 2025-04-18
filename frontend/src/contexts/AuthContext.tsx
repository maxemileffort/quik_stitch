import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
// Removed axios import
import { Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { toast } from 'react-toastify';
import apiClient from '../lib/apiClient'; // Import the shared apiClient

// Define the structure for our user object from the backend
// Keep email and isPaidUser, id might come from the backend session/token
export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  isPaidUser: boolean;
  isAdmin: boolean; // Add isAdmin field
}

// Define the shape of the Auth Context
interface AuthContextType {
  user: AuthUser | null;
  loading: boolean; // Still useful for initial load and logout
  requestMagicLink: (email: string) => Promise<{ success: boolean; message: string }>;
  verifyMagicLink: (token: string) => Promise<{ success: boolean; user: AuthUser | null; message: string }>;
  // checkSession is removed, handled by onAuthStateChange
  logout: () => Promise<void>;
}

// Create the Auth Context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Custom hook to use the Auth Context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Removed local apiClient setup

// Removed mapSupabaseUserToAuthUser as fetching logic is now integrated

// Auth Provider Component
export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true); // Start loading true for initial session check

  // Function to fetch user profile from our backend
  const fetchUserProfile = async () => {
    try {
      const response = await apiClient.get<{ user: AuthUser }>('/auth/me');
      if (response.data && response.data.user) {
        console.log("Fetched user profile from backend:", response.data.user);
        setUser(response.data.user); // Set user state with backend data
      } else {
        console.warn("Backend /auth/me did not return a user object.");
        setUser(null); // Ensure user is null if backend doesn't provide data
      }
    } catch (error: any) {
      console.error("Error fetching user profile from backend:", error);
      // If fetching profile fails (e.g., 401, network error), treat as logged out
      setUser(null);
      // Don't automatically sign out from Supabase here, as the token might still be valid
      // but our backend call failed. Let Supabase state dictate login status.
      if (error.response?.status === 401) {
        // If specifically unauthorized, maybe force Supabase sign out?
        // await supabase.auth.signOut(); // Consider implications
        console.log("Received 401 fetching /auth/me, user set to null.");
      }
    }
  };

  // Listen to Supabase auth state changes
  useEffect(() => {
    setLoading(true);

    // 1. Handle initial session check AND profile fetch
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        console.log("Initial session found, fetching profile...");
        await fetchUserProfile(); // Fetch profile if session exists
      } else {
        console.log("No initial session found.");
        setUser(null); // No session, no user
      }
      setLoading(false); // Initial check and potential fetch done
    }).catch((error) => {
        console.error("Error getting initial session:", error);
        setUser(null);
        setLoading(false); // Still finish loading even on error
    });

    // 2. Subscribe to future auth state changes
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log("Supabase Auth Event:", event, session);
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
          // User is signed in or session refreshed, fetch/update profile
          if (session) {
             console.log(`Auth event ${event}, fetching profile...`);
             setLoading(true); // Show loading while fetching profile
             await fetchUserProfile();
             setLoading(false);
          } else {
             // Should not happen for SIGNED_IN, but handle defensively
             console.warn(`Auth event ${event} but no session found.`);
             setUser(null);
          }
        } else if (event === 'SIGNED_OUT') {
          // User signed out
          console.log("Auth event SIGNED_OUT, setting user to null.");
          setUser(null);
        }
        // Other events like PASSWORD_RECOVERY, USER_DELETED could be handled here
      }
    );

    // Cleanup listener on component unmount
    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []);


  // Function to request a magic link from the backend
  const requestMagicLink = async (email: string): Promise<{ success: boolean; message: string }> => {
    // setLoading(true); // Optional: maybe show loading state on the button itself
    try {
      // Endpoint is correct as per backend/server.js
      await apiClient.post('/auth/magic-link', { email });
      // setLoading(false);
      toast.success('Magic link sent! Check your email.'); // Success toast
      return { success: true, message: 'Magic link sent! Check your email.' };
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Failed to send magic link.';
      console.error('Error requesting magic link:', error);
      toast.error(errorMessage); // Error toast
      setLoading(false); // Ensure loading stops on error
      return { success: false, message: errorMessage };
    }
  };

  // Function to verify the magic link token with the backend
  const verifyMagicLink = async (token: string): Promise<{ success: boolean; user: AuthUser | null; message: string }> => {
    setLoading(true);
    try {
      const response = await apiClient.post<{ user: AuthUser }>('/auth/verify', { token });
      if (response.data && response.data.user) {
        // setUser will be handled by onAuthStateChange, but we can still show success
        setLoading(false);
        toast.success('Login successful!'); // Success toast
        return { success: true, user: response.data.user, message: 'Login successful!' };
      } else {
        // Should ideally not happen if backend sends user on success
        setUser(null);
        setLoading(false);
        toast.error('Verification failed.'); // Error toast
        return { success: false, user: null, message: 'Verification failed.' };
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Failed to verify magic link.';
      console.error('Error verifying magic link:', error);
      toast.error(errorMessage); // Error toast
      setUser(null); // Clear user on verification error
      setLoading(false);
      return { success: false, user: null, message: errorMessage };
    }
  };

  // Function to log out by calling the backend AND Supabase
  const logout = async () => {
    setLoading(true); // Show loading during logout process
    try {
      // Call backend first (optional, depending on backend session needs)
      await apiClient.post('/auth/logout');
      // Then sign out from Supabase client-side
      const { error: supabaseError } = await supabase.auth.signOut();
      if (supabaseError) {
        console.error('Error signing out from Supabase:', supabaseError);
        toast.error('Logout failed. Please try again.'); // Error toast
        // Handle Supabase sign-out error if necessary, but proceed to clear local state
      } else {
         toast.success('Logged out successfully.'); // Success toast
      }
      // setUser(null) will be handled by onAuthStateChange listener
    } catch (error) {
      console.error('Error logging out via backend:', error);
      toast.error('Logout failed. Please try again.'); // Error toast
      // Still attempt Supabase sign out even if backend call fails
      const { error: supabaseError } = await supabase.auth.signOut();
       if (supabaseError) {
        console.error('Error signing out from Supabase after backend failure:', supabaseError);
        // Avoid double toast if backend failed and supabase failed
      }
      // setUser(null) will be handled by onAuthStateChange listener
    } finally {
      // Let onAuthStateChange handle setting user to null
      setLoading(false); // Hide loading indicator
    }
  };

  // Define the context value
  const value: AuthContextType = {
    user,
    loading,
    requestMagicLink,
    verifyMagicLink,
    // checkSession removed
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {/* Render children only when not loading */}
      {!loading ? children : (
        <div className="flex justify-center items-center min-h-screen">
          <Loader2 className="h-12 w-12 animate-spin text-blue-500" />
        </div>
      )}
    </AuthContext.Provider>
  );
};
