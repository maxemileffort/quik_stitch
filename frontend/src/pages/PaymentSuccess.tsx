import React, { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';
// Optional: Import useAuth if you need to refresh user data
// import { useAuth } from '../contexts/AuthContext';

const PaymentSuccess: React.FC = () => {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  // Optional: Get auth context methods if needed
  // const { refreshUserProfile } = useAuth(); // Assuming you add a refresh function to AuthContext

  useEffect(() => {
    // You might want to verify the session ID with your backend here
    // for extra security, although the webhook is the primary confirmation method.
    console.log('Payment successful for session:', sessionId);

    // Optional: Trigger a refresh of user data after successful payment
    // if (refreshUserProfile) {
    //   refreshUserProfile();
    // }

    // Clear any relevant local state if needed (e.g., cart items)

  }, [sessionId/*, refreshUserProfile*/]);

  return (
    <div className="container mx-auto px-4 py-8 text-center">
      <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
      <h1 className="text-3xl font-bold mb-4">Payment Successful!</h1>
      <p className="text-lg mb-6">Thank you for your purchase. Your payment has been processed successfully.</p>
      {/* You might want to fetch order details or update user status here */}
      <p className="text-gray-600 mb-8">Session ID: {sessionId || 'N/A'}</p>
      <Link
        to="/dashboard" // Redirect to dashboard or relevant page
        className="px-6 py-3 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        Go to Dashboard
      </Link>
    </div>
  );
};

export default PaymentSuccess;
