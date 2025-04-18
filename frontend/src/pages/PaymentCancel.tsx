import React from 'react';
import { Link } from 'react-router-dom';
import { XCircle } from 'lucide-react';

const PaymentCancel: React.FC = () => {
  return (
    <div className="container mx-auto px-4 py-8 text-center">
      <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
      <h1 className="text-3xl font-bold mb-4">Payment Cancelled</h1>
      <p className="text-lg mb-6">Your payment process was cancelled. You have not been charged.</p>
      <p className="text-gray-600 mb-8">If you encountered an issue, please try again or contact support.</p>
      <div className="space-x-4">
        <Link
          to="/pricing" // Link back to the pricing page to try upgrading again
          className="px-6 py-3 bg-gray-300 text-gray-800 rounded hover:bg-gray-400"
        >
          View Pricing
        </Link>
        <Link
          to="/dashboard"
          className="px-6 py-3 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
};

export default PaymentCancel;
