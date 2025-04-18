// frontend/src/pages/Upload.tsx
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import AuthModal from '../components/AuthModal';
import { useFileUploader, UploadedFile } from '../hooks/useFileUploader';
import { useJobCreator } from '../hooks/useJobCreator';
import DropzoneArea from '../components/Upload/DropzoneArea';
import UploadedFileList from '../components/Upload/UploadedFileList';
import UploadActions from '../components/Upload/UploadActions';

const Upload = () => {
  const { user } = useAuth();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Use the custom hooks
  const {
    uploadedFiles,
    setUploadedFiles, // Needed for reordering
    addFiles,
    removeFile,
  } = useFileUploader();

  const { createJob, isSubmitting, submitError } = useJobCreator(user, uploadedFiles);

  // Handler for reordering files from UploadedFileList
  const handleReorderFiles = (reorderedFiles: UploadedFile[]) => {
    setUploadedFiles(reorderedFiles);
  };

  // Handler to trigger auth modal from UploadActions
  const handleTriggerAuth = () => {
    setIsAuthModalOpen(true);
  };

  // Define accepted file types for DropzoneArea
  const acceptFileTypes = {
    'video/*': ['.mp4', '.mov', '.webm'],
  };

  return (
    <>
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="space-y-8">
          {/* Page Header */}
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Upload Your Videos</h2>
            <p className="mt-1 text-sm text-gray-500">
              Drag and drop your videos, arrange them, and create a stitching job.
            </p>
          </div>

          {/* Dropzone Area */}
          <DropzoneArea onDrop={addFiles} accept={acceptFileTypes} />

          {/* Uploaded Files List (only show if files exist) */}
          {uploadedFiles.length > 0 && (
            <>
              <UploadedFileList
                files={uploadedFiles}
                onRemoveFile={removeFile}
                onReorderFiles={handleReorderFiles}
              />
              <UploadActions
                files={uploadedFiles}
                isSubmitting={isSubmitting}
                submitError={submitError}
                onCreateJob={createJob} // Pass the createJob function from the hook
                onTriggerAuth={handleTriggerAuth}
                user={user} // Pass the full user object
              />
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default Upload;
