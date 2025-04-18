// frontend/src/hooks/useFileUploader.ts
import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export interface UploadedFile {
  id: string; // Unique ID (e.g., file name + timestamp)
  file: File;
  status: 'uploading' | 'success' | 'error';
  progress?: number; // Optional upload progress
  storagePath?: string; // Path in Supabase Storage
  error?: string; // Error message
  preview?: string; // Data URL for preview
}

export const useFileUploader = () => {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const { user } = useAuth();

  // Function to update the status of a specific file
  const updateFileStatus = useCallback((id: string, status: UploadedFile['status'], data?: Partial<UploadedFile>) => {
    setUploadedFiles(prevFiles =>
      prevFiles.map(f => (f.id === id ? { ...f, status, ...data } : f))
    );
  }, []); // No dependencies needed here as setUploadedFiles is stable

  const addFiles = useCallback((acceptedFiles: File[]) => {
    const newUploads: UploadedFile[] = acceptedFiles.map(file => {
      const userIdForPath = user ? user.id : 'anonymous'; // Handle anonymous uploads
      const fileId = `${file.name}-${Date.now()}`; // Create a unique ID
      const preview = URL.createObjectURL(file);
      const newUpload: UploadedFile = {
        id: fileId,
        file: file,
        status: 'uploading',
        preview: preview,
      };

      // Start the upload process
      const uploadPath = `user-${userIdForPath}/${fileId}-${file.name}`;
      console.log(`Uploading ${file.name} to ${uploadPath}`);

      supabase.storage
        .from('uploads') // Ensure this is your bucket name
        .upload(uploadPath, file, { cacheControl: '3600', upsert: false })
        .then(({ data, error }) => {
          if (error) {
            console.error(`Supabase upload error for ${file.name}:`, error);
            let userErrorMessage = 'Upload failed. Please try again.';
            // Add specific error handling as before
            if (error.message.includes('Bucket not found')) userErrorMessage = 'Upload configuration error.';
            else if (error.message.includes('exceeded')) userErrorMessage = 'File size limit exceeded.';
            else if (error.message.includes('mime type')) userErrorMessage = 'Invalid file type.';
            updateFileStatus(fileId, 'error', { error: userErrorMessage });
          } else if (data) {
            console.log(`Supabase upload success for ${file.name}:`, data);
            updateFileStatus(fileId, 'success', { storagePath: data.path });
          } else {
             console.error(`Unknown upload error for ${file.name}`);
             updateFileStatus(fileId, 'error', { error: 'Unknown upload error' });
          }
        })
        .catch(err => {
           console.error(`Supabase upload exception for ${file.name}:`, err);
           updateFileStatus(fileId, 'error', { error: 'Upload failed unexpectedly.' });
        });

      return newUpload;
    });

    setUploadedFiles(prevFiles => [...prevFiles, ...newUploads]);

  }, [user, updateFileStatus]);

  const removeFile = useCallback((id: string) => {
    setUploadedFiles(prevFiles => {
      const fileToRemove = prevFiles.find(f => f.id === id);
      if (fileToRemove?.preview) {
        URL.revokeObjectURL(fileToRemove.preview);
      }
      // Optionally delete from Supabase Storage
      if (fileToRemove?.status === 'success' && fileToRemove.storagePath) {
        console.log(`Removing ${fileToRemove.storagePath} from Supabase Storage.`);
        supabase.storage.from('uploads').remove([fileToRemove.storagePath])
          .then(({ data, error }) => {
            if (error) console.error(`Error removing ${fileToRemove.storagePath} from storage:`, error);
            else console.log(`Successfully removed ${fileToRemove.storagePath} from storage:`, data);
          });
      }
      return prevFiles.filter(f => f.id !== id);
    });
  }, []); // No dependencies needed here

  // Clean up preview URLs on unmount
  useEffect(() => {
    return () => {
      uploadedFiles.forEach(f => {
        if (f.preview) {
          URL.revokeObjectURL(f.preview);
        }
      });
    };
  }, [uploadedFiles]); // Re-run if uploadedFiles array changes identity

  return {
    uploadedFiles,
    setUploadedFiles, // Expose setter for reordering
    addFiles,
    removeFile,
    updateFileStatus, // Might be needed externally? If not, can remove export
  };
};
