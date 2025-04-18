import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Scissors, User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import AuthModal from './AuthModal';

const Navbar = () => {
  const { user, logout } = useAuth(); // Use logout from the new context
  const [showAuthModal, setShowAuthModal] = useState(false);
  // Removed authMode state

  const handleOpenAuthModal = () => {
    setShowAuthModal(true);
  };

  return (
    <>
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <Link to="/" className="flex items-center">
                <Scissors className="h-8 w-8 text-blue-600" />
                <span className="ml-2 text-xl font-bold text-gray-900">QuikStitch</span>
              </Link>
              {/* Add Pricing link visible to all */}
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                 <Link
                    to="/pricing"
                    className="inline-flex items-center px-1 pt-1 border-b-2 border-transparent text-sm font-medium text-gray-500 hover:border-gray-300 hover:text-gray-700"
                  >
                    Pricing
                  </Link>
              </div>
            </div>
            <div className="flex items-center space-x-4">
               {/* Mobile menu button placeholder if needed */}
               {/* <div className="-mr-2 flex items-center sm:hidden"> ... </div> */}

              {user ? (
                <>
                  <Link
                    to="/upload"
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                  >
                    Upload Videos
                  </Link>
                  <Link
                    to="/dashboard"
                    className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
                  >
                    Dashboard
                  </Link>
                  {/* Conditionally render Admin link */}
                  {user.isAdmin && (
                    <Link
                      to="/admin"
                      className="text-red-600 hover:text-red-800 px-3 py-2 rounded-md text-sm font-medium" // Style differently for visibility
                    >
                      Admin
                    </Link>
                  )}
                  <div className="relative group">
                    <button className="flex items-center space-x-2 text-gray-600 hover:text-gray-900">
                      <User className="h-5 w-5" />
                      {/* Display user email or name if available */}
                      <span className="text-sm font-medium">{user.name || user.email?.split('@')[0]}</span>
                    </button>
                    <div className="absolute right-0 w-48 mt-2 py-1 bg-white rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10"> {/* Added z-index */}
                      <button
                        onClick={logout} // Call the logout function from context
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
                      >
                        Sign Out
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                // Single button to open the magic link modal
                <button
                  onClick={handleOpenAuthModal}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                >
                  Sign In / Sign Up
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Render AuthModal without the mode prop */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
      />
    </>
  );
};

export default Navbar;
