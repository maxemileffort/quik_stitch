// frontend/src/components/Upload/UploadActions.tsx
import React from 'react';
import { Loader2 } from 'lucide-react';
import { UploadedFile } from '../../hooks/useFileUploader'; // Adjust path
// Import AuthUser from the context
import { AuthUser } from '../../contexts/AuthContext'; // Adjust path if needed

interface UploadActionsProps {
  files: UploadedFile[];
  isSubmitting: boolean;
  submitError: string | null;
  onCreateJob: (jobType: 'STITCHING' | 'TRANSCRIPTION') => void; // Function to trigger job creation
  onTriggerAuth: () => void; // Function to open the auth modal if needed
  user: AuthUser | null; // Use the full user object
}

const UploadActions: React.FC<UploadActionsProps> = ({
  files,
  isSubmitting,
  submitError,
  onCreateJob,
  onTriggerAuth,
  user, // Use the user object prop
}) => {
  // Determine if the button should be disabled
  const hasPendingOrFailed = files.some(f => f.status !== 'success');
  const hasSuccessfulUploads = files.some(f => f.status === 'success');
  // Common disable condition for all action buttons
  const isActionDisabled = isSubmitting || !hasSuccessfulUploads || hasPendingOrFailed;

  // Specific handler for Stitching Job
  const handleCreateStitchingJob = () => {
    if (!user) {
      onTriggerAuth(); // Ask parent to open auth modal
    } else {
      onCreateJob('STITCHING');
    }
  };

  // Specific handler for Transcription Job
  const handleCreateTranscriptionJob = () => {
    // Should only be clickable if user && user.isPaidUser is true, but double-check
    if (user && user.isPaidUser) {
      onCreateJob('TRANSCRIPTION');
    } else if (!user) {
      onTriggerAuth(); // Ask to log in if somehow clicked while logged out
    } else {
      // Handle case where a non-paid user somehow clicks (e.g., show a message)
      console.warn("Transcription button clicked by non-paid user.");
      // Optionally show a toast or modal explaining the feature requires payment
    }
  };


  return (
    <div className="mt-8 space-y-4">
      {/* Display submission error */}
      {submitError && (
        <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm border border-red-200">
          {submitError}
        </div>
      )}
      <div className="flex flex-wrap gap-4"> {/* Use gap for spacing */}
        {/* Stitching Job Button */}
        <button
          onClick={handleCreateStitchingJob}
          type="button"
          disabled={isActionDisabled}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? ( // Show spinner only if this specific action is submitting? Or general isSubmitting?
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : null}
          {user ? 'Create Stitching Job' : 'Login to Create Job'}
        </button>

        {/* Transcription Job Button (Conditional) */}
        {user && user.isPaidUser && (
          <button
            onClick={handleCreateTranscriptionJob}
            type="button"
            disabled={isActionDisabled} // Disable under the same conditions
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Create a job that includes AI-powered transcription and captioning." // Tooltip
          >
            {isSubmitting ? ( // Consider if a separate loading state per button is needed
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            Create Transcription Job
          </button>
        )}

        {/* Optional: Show a disabled/different message for non-paid users */}
        {user && !user.isPaidUser && (
           <button
            type="button"
            disabled={true} // Always disabled for non-paid users
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-500 bg-gray-100 cursor-not-allowed"
            title="AI Transcription requires a paid subscription." // Tooltip
          >
            AI Transcription (Upgrade Required)
          </button>
        )}
      </div>
       {/* Informational message if uploads are pending/failed */}
       {(hasPendingOrFailed && hasSuccessfulUploads && !isSubmitting) && (
         <p className="text-sm text-yellow-700">
           Please wait for all uploads to complete or remove failed uploads before creating a job.
         </p>
       )}
       {!hasSuccessfulUploads && files.length > 0 && !isSubmitting && (
         <p className="text-sm text-gray-500">
           Upload at least one video successfully to create a job.
         </p>
       )}
    </div>
  );
};

export default UploadActions;
