import React, { useState, useEffect } from 'react'; // Added useEffect
import { useLocation, useNavigate } from 'react-router-dom';
import { Upload as UploadIcon, Wand2 } from 'lucide-react';
import AICaptionExtractor from '../components/AICaptionExtractor';
import ManualCaptionUploader from '../components/ManualCaptionUploader';
import { useAuth } from '../contexts/AuthContext'; // Import useAuth
// Consider adding a tooltip library if you want tooltips:
// import { Tooltip } from 'react-tooltip'; 

function Captions() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth(); // Get user and loading state
  // Ensure videos is always an array, even if state is null/undefined
  const videos: File[] = location.state?.videos || []; 

  // Determine if the user is eligible for AI captions
  const canUseAI = !authLoading && (user?.isPaidUser ?? false); 
  
  // Default to manual if AI is not allowed or auth is loading, otherwise default to auto
  const [captionSource, setCaptionSource] = useState<'auto' | 'manual'>(
    canUseAI ? 'auto' : 'manual'
  );

  // Update default if auth state changes after initial load and AI becomes disallowed
  useEffect(() => {
    if (!authLoading && !canUseAI && captionSource === 'auto') {
      setCaptionSource('manual');
    }
    // If auth loads and AI *is* allowed, we don't force switch from manual if user selected it
  }, [canUseAI, authLoading, captionSource]);

  const skipCaptions = () => {
    navigate('/preview', { state: { videos } });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="space-y-8">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Add Captions</h2>
            <p className="mt-1 text-sm text-gray-500">
              Choose how you want to add captions to your videos
            </p>
          </div>
          <button
            onClick={skipCaptions}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Continue without captions →
          </button>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {/* AI Caption Option */}
          <div
            data-tooltip-id="ai-tooltip" // For optional tooltip
            className={`p-6 border-2 rounded-lg transition-colors relative ${ // Added relative positioning for potential overlay/tooltip anchor
              captionSource === 'auto' && canUseAI
                ? 'border-blue-500 bg-blue-50 cursor-pointer' // Active state
                : !canUseAI 
                  ? 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed' // Disabled state
                  : 'border-gray-200 hover:border-blue-300 cursor-pointer' // Inactive but available state
            }`}
            onClick={() => {
              if (canUseAI) {
                setCaptionSource('auto');
              }
              // Optionally show a message/modal if clicked when disabled
            }}
          >
            {/* Optional: Add a lock icon or overlay when disabled */}
            {!canUseAI && (
              <span className="absolute top-2 right-2 text-gray-400">🔒</span> 
            )}
            <Wand2 className={`h-8 w-8 mb-4 ${canUseAI ? 'text-blue-500' : 'text-gray-400'}`} />
            <h3 className={`text-lg font-medium ${canUseAI ? 'text-gray-900' : 'text-gray-500'}`}>AI Caption Extraction</h3>
            <p className={`mt-2 text-sm ${canUseAI ? 'text-gray-500' : 'text-gray-400'}`}>
              Automatically extract captions using AI. (Requires active subscription)
            </p>
            {/* Optional Tooltip Content (requires react-tooltip setup) */}
            {/* {!canUseAI && (
              <Tooltip id="ai-tooltip" place="top" effect="solid">
                Requires an active subscription. Please upgrade your account.
              </Tooltip>
            )} */}
          </div>

          {/* Manual Caption Option */}
          <div 
            className={`p-6 border-2 rounded-lg cursor-pointer transition-colors ${
              captionSource === 'manual' 
                ? 'border-blue-500 bg-blue-50' // Active state for manual
                : 'border-gray-200 hover:border-blue-300'
            }`}
            onClick={() => setCaptionSource('manual')}
          >
            <UploadIcon className="h-8 w-8 text-blue-500 mb-4" />
            <h3 className="text-lg font-medium text-gray-900">Upload Caption File</h3>
            <p className="mt-2 text-sm text-gray-500">
              Upload a CSV file with your own captions and timestamps
            </p>
          </div>
        </div>

        <div className="mt-8 min-h-[150px] flex flex-col justify-center items-center"> {/* Added flex for centering */}
          {/* Render components based on selection and availability */}
          {captionSource === 'auto' && canUseAI && (
            <AICaptionExtractor videos={videos} />
          )}
          {captionSource === 'manual' && (
            <ManualCaptionUploader videos={videos} />
          )}
          {/* Show a message if AI is selected but unavailable */}
          {captionSource === 'auto' && !canUseAI && (
            <div className="text-center text-gray-500 p-4 border border-gray-200 rounded-md bg-gray-50">
              <p>AI captioning requires an active subscription.</p>
              <p>Please select "Upload Caption File" or upgrade your account.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Captions;
