// frontend/src/hooks/useJobCreator.ts
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import apiClient from '../lib/apiClient';
import { UploadedFile } from './useFileUploader'; // Import the interface
// Import AuthUser from the context instead of Supabase User
import { AuthUser } from '../contexts/AuthContext'; // Adjust path if needed

export const useJobCreator = (user: AuthUser | null, uploadedFiles: UploadedFile[]) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const navigate = useNavigate();

  const createJob = async (jobType: 'STITCHING' | 'TRANSCRIPTION') => {
    // User check should ideally happen before calling this,
    // but double-check here for safety.
    if (!user) {
      // This hook shouldn't directly control the AuthModal.
      // The calling component should handle this based on the user state.
      setSubmitError("User not logged in."); // Set an error instead
      toast.error("Please log in to create a job.");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    const successfulUploads = uploadedFiles.filter(f => f.status === 'success');
    const failedUploads = uploadedFiles.filter(f => f.status === 'error');
    const pendingUploads = uploadedFiles.filter(f => f.status === 'uploading');

    if (pendingUploads.length > 0) {
      const errorMsg = "Please wait for all uploads to complete.";
      setSubmitError(errorMsg);
      toast.warn(errorMsg); // Use warn for pending uploads
      setIsSubmitting(false);
      return;
    }

    if (successfulUploads.length === 0) {
      const errorMsg = "No files were successfully uploaded to create a job.";
      setSubmitError(errorMsg);
      toast.error(errorMsg);
      setIsSubmitting(false);
      return;
    }

    if (failedUploads.length > 0) {
       const errorMsg = `Some files failed to upload. Please remove them or try again. Failed: ${failedUploads.map(f => f.file.name).join(', ')}`;
       setSubmitError(errorMsg);
       toast.error(errorMsg);
       setIsSubmitting(false);
       return;
    }

    // Prepare data for the backend
    const inputFilePaths = JSON.stringify(successfulUploads.map(f => f.storagePath));

     try {
       // Backend uses middleware to get user ID from token
       const response = await apiClient.post('/jobs', {
         type: jobType,
         inputFile: inputFilePaths,
       });

       if (response.status === 201) {
         console.log('Job created successfully:', response.data);
         // Use a generic success message, specific text can be in the component
         toast.success('Job created successfully! Redirecting...');
         navigate('/dashboard'); // Navigate on success
       } else {
         // Handle non-201 success statuses if applicable, or treat as error
         const errorMessage = response.data?.error || `Failed to create job (Status: ${response.status}).`;
         setSubmitError(errorMessage);
         toast.error(errorMessage);
       }
     } catch (error: any) {
       const errorMessage = error.response?.data?.error || 'An error occurred while creating the job.';
       console.error('Error creating job:', error);
       setSubmitError(errorMessage);
       toast.error(errorMessage);
     } finally {
       setIsSubmitting(false);
     }
  };

  return {
    createJob,
    isSubmitting,
    submitError,
  };
};
