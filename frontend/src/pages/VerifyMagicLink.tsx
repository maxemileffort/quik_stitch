import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';

const VerifyMagicLink: React.FC = () => {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Verifying your magic link...');
  const { user, loading } = useAuth(); // Get user and loading state from AuthContext
  const navigate = useNavigate();

  useEffect(() => {
    // Don't do anything while AuthContext is still loading the initial state
    if (loading) {
      return;
    }

    // If user is detected, authentication was successful
    if (user) {
      setMessage('Verification successful! Redirecting...');
      setStatus('success');
      const timer = setTimeout(() => {
        navigate('/dashboard'); // Redirect after a short delay
      }, 1500);
      return () => clearTimeout(timer); // Cleanup timer on unmount
    } else {
      // If AuthContext is loaded but there's no user, verification likely failed or timed out
      // Add a timeout to prevent staying here indefinitely if Supabase listener fails
      const errorTimer = setTimeout(() => {
        if (!user) { // Check again in case user appeared just before timeout
            setMessage('Verification failed or timed out. Please try requesting a new link.');
            setStatus('error');
        }
      }, 5000); // Wait 5 seconds for authentication

      return () => clearTimeout(errorTimer); // Cleanup error timer
    }
    // Depend on user and loading state from AuthContext
  }, [user, loading, navigate]);

  const renderStatus = () => {
    // Show loading indicator while AuthContext is loading OR while this component is loading/success
    if (loading || status === 'loading' || status === 'success') {
        return <Loader2 className="h-8 w-8 animate-spin text-blue-500" />;
    }
    // Only show specific icons for final states after loading is complete
    // The 'if' condition above handles 'loading' and 'success' display during verification.
    // This switch now only needs to handle the final 'error' state explicitly.
    switch (status) {
      case 'error':
        return <XCircle className="h-8 w-8 text-red-500" />;
      default: // Should ideally not be reached if logic is correct, but good practice
        return null;
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-center p-4">
      <div className="mb-4">{renderStatus()}</div>
      <p className="text-lg">{message}</p>
      {status === 'error' && (
        <button
          onClick={() => navigate('/')} // Navigate home on error
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Go to Homepage
        </button>
      )}
    </div>
  );
};

export default VerifyMagicLink;
