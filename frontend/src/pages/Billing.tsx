import React, { useState } from 'react';
import CheckoutButton from '../components/Billing/CheckoutButton'; // Import the checkout button
import { useAuth } from '../contexts/AuthContext'; // Import useAuth to check user status
import apiClient from '../lib/apiClient'; // Import apiClient for portal session
import { toast } from 'react-toastify'; // For showing errors

const Billing: React.FC = () => {
  const { user } = useAuth(); // Get user details, including isPaidUser
  const [loadingPortal, setLoadingPortal] = useState(false);

  const handleManageSubscription = async () => {
    setLoadingPortal(true);
    try {
      const response = await apiClient.post<{ url: string }>('/payments/create-portal-session');
      if (response.data.url) {
        window.location.href = response.data.url; // Redirect to Stripe Portal
      } else {
        toast.error('Could not retrieve the subscription management link.');
      }
    } catch (error: any) {
      console.error('Error creating portal session:', error);
      toast.error(error.response?.data?.error || 'Failed to access subscription management.');
      setLoadingPortal(false);
    }
    // No need to setLoadingPortal(false) on success, as the page redirects
  };


  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Billing</h1>

      {/* Section for Subscribing or Managing Subscription */}
      <div className="bg-white p-6 rounded shadow-md mb-8">
        {user?.isPaidUser ? (
          <>
            <h2 className="text-xl font-semibold mb-4">Manage Your Subscription</h2>
            <p className="text-gray-700 mb-4">
              You have an active subscription. Click below to manage your billing details, view invoices, or cancel your subscription.
            </p>
            <button
              onClick={handleManageSubscription}
              disabled={loadingPortal}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
            >
              {loadingPortal ? 'Loading...' : 'Manage Subscription'}
            </button>
          </>
        ) : (
          <>
            <h2 className="text-xl font-semibold mb-4">Subscribe Now</h2>
            <p className="text-gray-700 mb-4">
              Unlock all features by subscribing to our monthly plan.
              {/* Add details about the plan */}
            </p>
            <CheckoutButton />
          </>
        )}
      </div>

      {/* Optional: Add other billing sections like invoice history */}
      {/* <div className="mt-8 bg-white p-6 rounded shadow-md">
        <h2 className="text-xl font-semibold mb-4">Current Plan</h2>
        <p>Details about the user's current subscription or credit balance.</p>
      </div> */}
    </div>
  );
};

export default Billing;
