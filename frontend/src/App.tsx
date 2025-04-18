// import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
// import { Video, Scissors } from 'lucide-react';
import { AuthProvider } from './contexts/AuthContext';
import { ToastContainer } from 'react-toastify'; // Import ToastContainer
import 'react-toastify/dist/ReactToastify.css'; // Import CSS
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Upload from './pages/Upload';
import Preview from './pages/Preview';
import Dashboard from './pages/Dashboard';
import Captions from './pages/Captions';
import VerifyMagicLink from './pages/VerifyMagicLink'; // Import the new page
import PaymentSuccess from './pages/PaymentSuccess'; // Import Payment Success page
import PaymentCancel from './pages/PaymentCancel'; // Import Payment Cancel page
import Billing from './pages/Billing'; // Import Billing page
import AdminRoute from './components/AdminRoute'; // Import the admin route protector
import AdminDashboard from './pages/AdminDashboard'; // Import the admin dashboard page

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen bg-gray-50">
          <Navbar />
          <main> {/* Optional: Wrap routes in main for semantics */}
            <Routes>
              <Route path="/" element={<Home />} />
            <Route path="/upload" element={<Upload />} />
            <Route path="/captions" element={<Captions />} />
            {/* Update preview route to accept jobId parameter */}
            <Route path="/preview/:jobId" element={<Preview />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/verify-magic-link" element={<VerifyMagicLink />} /> {/* Add route for verification */}
              <Route path="/payment-success" element={<PaymentSuccess />} /> {/* Add route for payment success */}
              <Route path="/payment-cancel" element={<PaymentCancel />} /> {/* Add route for payment cancel */}
              <Route path="/billing" element={<Billing />} /> {/* Add route for billing page */}

              {/* Admin Route */}
              <Route path="/admin" element={<AdminRoute />}>
                {/* Nested route rendered by Outlet in AdminRoute */}
                <Route index element={<AdminDashboard />} />
                {/* Add more admin sub-routes here if needed */}
                {/* e.g., <Route path="users" element={<AdminUserManagement />} /> */}
              </Route>
            </Routes>
          </main>
          <ToastContainer
            position="bottom-right" // Position the toasts
            autoClose={5000} // Auto close after 5 seconds
            hideProgressBar={false}
            newestOnTop={false}
            closeOnClick
            rtl={false}
            pauseOnFocusLoss
            draggable
            pauseOnHover
            theme="light" // Or "dark" or "colored"
          />
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
