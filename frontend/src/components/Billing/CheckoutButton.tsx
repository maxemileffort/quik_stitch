import React, { useState } from 'react';
import { useStripe } from '@stripe/react-stripe-js';
import apiClient from '../../lib/apiClient'; // API client handles auth token automatically
import { useAuth } from '../../contexts/AuthContext'; // Assuming you have an AuthContext

const CheckoutButton: React.FC = () => {
  const stripe = useStripe();
  const { user } = useAuth(); // Get user state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCheckout = async () => {
    // Check if Stripe.js has loaded and user is logged in
    if (!stripe || !user) {
      setError('Stripe.js has not loaded yet or user is not authenticated.');
      console.error('Stripe.js not loaded or user not authenticated.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Call your backend to create the checkout session
      // apiClient interceptor automatically adds the Authorization header
      const response = await apiClient.post('/payments/create-checkout-session',
        {
          // You might pass product details or job ID here if needed
          // e.g., productId: 'prod_XYZ', jobId: 'job_123'
        }
        // No need to manually add headers here, apiClient handles it
      );

      const session = response.data;

      // When the customer clicks on the button, redirect them to Checkout.
      const result = await stripe.redirectToCheckout({
        sessionId: session.id,
      });

      if (result.error) {
        // If `redirectToCheckout` fails due to a browser or network
        // error, display the localized error message to your customer.
        console.error('Stripe redirect error:', result.error.message);
        setError(result.error.message || 'An unexpected error occurred during redirect.');
        setLoading(false);
      }
      // Redirect happens automatically if successful, so loading state might not reset here unless there's an error.

    } catch (err: any) {
      console.error('Error creating checkout session:', err);
      setError(err.response?.data?.error || err.message || 'Failed to initiate checkout.');
      setLoading(false);
    }
  };

  return (
    <div>
      <button
        onClick={handleCheckout}
        disabled={loading || !stripe || !user}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? 'Processing...' : 'Proceed to Checkout'}
      </button>
      {error && <p className="text-red-500 mt-2">{error}</p>}
    </div>
  );
};

export default CheckoutButton;
