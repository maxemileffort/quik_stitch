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
  refreshUserProfile: () => Promise<void>; // Add function to refresh user data
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
  const [loading, setLoading] = useState(true); // For initial load spinner
  const [initialLoadComplete, setInitialLoadComplete] = useState(false); // Track initial load

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
     } finally {
        // Add logging to confirm this function always finishes execution path
        console.log(`fetchUserProfile finished execution.`);
     }
   };

   // Listen to Supabase auth state changes
  useEffect(() => {
    let isMounted = true; // Prevent state updates on unmounted component
    setLoading(true);

    const checkSessionAndFetch = async () => {
      try {
        // 1. Check for existing session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          throw sessionError; // Throw to be caught by outer catch
        }

         // 2. If session exists, fetch profile; otherwise, clear user
         if (session) {
           console.log("Initial session found, attempting profile fetch...");
           console.log(">>> BEFORE await fetchUserProfile (initial load)");
           try {
             // fetchUserProfile already handles setting user state (including null on error)
             await fetchUserProfile();
             console.log(">>> AFTER await fetchUserProfile (initial load)");
             console.log("Profile fetch attempt complete (initial load).");
           } catch (profileError) {
             // Log profile fetch error, but don't block loading completion.
            // setUser(null) is handled within fetchUserProfile's catch block.
            console.error("Error fetching profile during initial load:", profileError);
          }
        } else {
          console.log("No initial session found.");
          if (isMounted) setUser(null); // No session, no user
        }

      } catch (error) {
        // Catch errors from getSession or profile fetch if they bubble up
        console.error("Error during initial session check/fetch:", error);
        if (isMounted) setUser(null); // Clear user on error
       } finally {
        // Ensure loading is always set to false after check/fetch attempt
        if (isMounted) {
            console.log(">>> AuthContext finally block reached. isMounted:", isMounted); // Added log
            console.log("Setting loading to false (initial load).");
            setLoading(false);
            setInitialLoadComplete(true); // Mark initial load as complete
        }
      }
    };

    checkSessionAndFetch();

    // 3. Subscribe to future auth state changes (no loading state changes here)
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log("Supabase Auth Event:", event, session);

        // --- Add check for initial load completion ---
        if (!initialLoadComplete) {
          console.log(`Auth event ${event} received before initial load complete, skipping background fetch.`);
          return;
        }
        // --- End check ---

        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
          // User is signed in or session refreshed, fetch/update profile
           if (session) {
              console.log(`Auth event ${event}, fetching profile (background)...`);
              // setLoading(true); // Don't show full loader for background updates
              await fetchUserProfile(); // Fetch profile to ensure data is fresh
              // setLoading(false); // Loading state is not managed here anymore
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

    // Cleanup listener and isMounted flag on component unmount
    return () => {
      isMounted = false;
      authListener?.subscription.unsubscribe();
    };
  }, []); // Empty dependency array ensures this runs only once


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
    refreshUserProfile: fetchUserProfile, // Expose fetchUserProfile as refreshUserProfile
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
