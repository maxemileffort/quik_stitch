import React from 'react';
import { CheckCircle, XCircle, Zap, Edit } from 'lucide-react'; // Icons for features
import { useAuth } from '../contexts/AuthContext';
import apiClient from '../lib/apiClient'; // To call backend
import { loadStripe } from '@stripe/stripe-js';
import { toast } from 'react-toastify';

// Load Stripe promise outside component to avoid recreating on render
// Use the environment variable for the publishable key
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_TEST_PUB_KEY || import.meta.env.VITE_STRIPE_PROD_PUB_KEY || '');

const PricingPage: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const [isProcessing, setIsProcessing] = React.useState(false);

  const handleUpgradeClick = async () => {
    if (!user) {
      toast.error("Please log in to upgrade your plan.");
      // Optionally, trigger login modal here
      return;
    }

    if (user.isPaidUser) {
        toast.info("You are already on the VIP plan!");
        return;
    }

    setIsProcessing(true);
    try {
      // 1. Call backend to create a checkout session
      const response = await apiClient.post<{ id: string }>('/payments/create-checkout-session');
      const sessionId = response.data.id;

      // 2. Redirect to Stripe Checkout
      const stripe = await stripePromise;
      if (!stripe) {
        throw new Error("Stripe.js failed to load.");
      }

      const { error } = await stripe.redirectToCheckout({ sessionId });

      if (error) {
        console.error("Stripe redirect error:", error);
        toast.error(error.message || "Failed to redirect to Stripe. Please try again.");
      }
      // If redirect is successful, the user leaves this page.
      // If it fails, error is handled above.

    } catch (error: any) {
      console.error("Error creating checkout session:", error);
      const errorMessage = error.response?.data?.error || "An error occurred during checkout setup.";
      toast.error(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleManageSubscription = async () => {
    if (!user) {
        toast.error("Please log in to manage your subscription.");
        return;
    }
    if (!user.isPaidUser) {
        toast.info("You are currently on the Free plan.");
        return;
    }

    setIsProcessing(true);
    try {
        const response = await apiClient.post<{ url: string }>('/payments/create-portal-session');
        const portalUrl = response.data.url;
        window.location.href = portalUrl; // Redirect to Stripe Billing Portal
    } catch (error: any) {
        console.error("Error creating portal session:", error);
        const errorMessage = error.response?.data?.error || "Could not open billing management.";
        toast.error(errorMessage);
    } finally {
        setIsProcessing(false);
    }
  };


  return (
    <div className="container mx-auto px-4 py-12">
      <h1 className="text-4xl font-bold text-center mb-4 text-gray-800">Unlock Your Video Superpowers</h1>
      <p className="text-xl text-center text-gray-600 mb-12 max-w-3xl mx-auto">
        Stop wrestling with tedious edits. QuikStitch transforms your raw footage into perfectly captioned, ready-to-share videos in minutes, not hours. Choose the plan that fits your creative flow.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
        {/* Free Tier */}
        <div className="border rounded-lg p-6 shadow-lg bg-white flex flex-col">
          <h2 className="text-2xl font-semibold mb-4 text-gray-700">Free</h2>
          <p className="text-gray-500 mb-6 flex-grow">Perfect for getting started and basic video stitching.</p>
          <ul className="space-y-3 mb-8 text-gray-600">
            <li className="flex items-center"><CheckCircle className="w-5 h-5 text-green-500 mr-2" /> Manual Caption Upload</li>
            <li className="flex items-center"><CheckCircle className="w-5 h-5 text-green-500 mr-2" /> Basic Video Stitching</li>
            <li className="flex items-center"><CheckCircle className="w-5 h-5 text-green-500 mr-2" /> Standard Processing Speed</li>
            <li className="flex items-center"><XCircle className="w-5 h-5 text-red-400 mr-2" /> AI-Powered Transcription</li>
            <li className="flex items-center"><XCircle className="w-5 h-5 text-red-400 mr-2" /> AI Video Editing Tools</li>
            <li className="flex items-center"><XCircle className="w-5 h-5 text-red-400 mr-2" /> Priority Support</li>
          </ul>
          <div className="mt-auto">
            <p className="text-3xl font-bold text-center mb-6">$0<span className="text-lg font-normal text-gray-500">/month</span></p>
            {user && !user.isPaidUser && (
                 <p className="text-center text-green-600 font-semibold py-2 px-4 border border-green-600 rounded-md">Your Current Plan</p>
            )}
             {!user && (
                 <p className="text-center text-gray-500 py-2 px-4 border border-gray-300 rounded-md">Get Started</p>
            )}
             {user && user.isPaidUser && (
                 <p className="text-center text-gray-500 py-2 px-4 border border-gray-300 rounded-md">Free Plan</p>
            )}
          </div>
        </div>

        {/* VIP Tier */}
        <div className="border rounded-lg p-6 shadow-lg bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col ring-2 ring-indigo-500">
          <h2 className="text-2xl font-semibold mb-4 text-indigo-800">VIP Access</h2>
          <p className="text-indigo-600 mb-6 flex-grow">Unleash the full potential of AI for effortless video creation and editing.</p>
          <ul className="space-y-3 mb-8 text-gray-700">
            <li className="flex items-center"><CheckCircle className="w-5 h-5 text-green-500 mr-2" /> Manual Caption Upload</li>
            <li className="flex items-center"><CheckCircle className="w-5 h-5 text-green-500 mr-2" /> Basic Video Stitching</li>
            <li className="flex items-center"><Zap className="w-5 h-5 text-yellow-500 mr-2" /> <span className="font-semibold">AI-Powered Transcription</span></li>
            <li className="flex items-center"><Edit className="w-5 h-5 text-purple-500 mr-2" /> <span className="font-semibold">AI Video Editing Tools (Coming Soon!)</span></li>
            <li className="flex items-center"><CheckCircle className="w-5 h-5 text-green-500 mr-2" /> Faster Processing</li>
            <li className="flex items-center"><CheckCircle className="w-5 h-5 text-green-500 mr-2" /> Priority Support</li>
          </ul>
          <div className="mt-auto">
             {/* TODO: Replace with your actual price */}
            <p className="text-3xl font-bold text-center mb-6 text-indigo-900">$19<span className="text-lg font-normal text-gray-500">/month</span></p>
            {authLoading ? (
                 <button className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 transition duration-200 opacity-50 cursor-not-allowed" disabled>
                    Loading...
                 </button>
            ) : user && user.isPaidUser ? (
                 <button
                    onClick={handleManageSubscription}
                    disabled={isProcessing}
                    className={`w-full py-2 px-4 rounded-md transition duration-200 ${isProcessing ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 text-white'}`}
                 >
                    {isProcessing ? 'Processing...' : 'Manage Subscription'}
                 </button>
            ) : (
                 <button
                    onClick={handleUpgradeClick}
                    disabled={isProcessing || !user} // Disable if not logged in
                    className={`w-full py-2 px-4 rounded-md transition duration-200 ${isProcessing || !user ? 'bg-gray-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}
                 >
                    {isProcessing ? 'Processing...' : (user ? 'Upgrade to VIP' : 'Login to Upgrade')}
                 </button>
            )}
          </div>
        </div>
      </div>

      <p className="text-center text-gray-500 mt-10 text-sm">
        Prices shown are examples. Secure payment processing via Stripe. You can cancel anytime.
      </p>
    </div>
  );
};

export default PricingPage;
