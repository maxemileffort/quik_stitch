// frontend/src/components/Upload/DropzoneArea.tsx
import React from 'react';
import { useDropzone, Accept } from 'react-dropzone';
import { Upload as UploadIcon } from 'lucide-react';

interface DropzoneAreaProps {
  onDrop: (acceptedFiles: File[]) => void;
  accept: Accept;
}

const DropzoneArea: React.FC<DropzoneAreaProps> = ({ onDrop, accept }) => {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept,
  });

  return (
    <div
      {...getRootProps()}
      className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors duration-200 ease-in-out ${
        isDragActive
          ? 'border-blue-500 bg-blue-50'
          : 'border-gray-300 hover:border-gray-400'
      }`}
    >
      <input {...getInputProps()} />
      <UploadIcon className="mx-auto h-12 w-12 text-gray-400" />
      <p className="mt-2 text-sm text-gray-500">
        {isDragActive
          ? 'Drop the files here ...'
          : 'Drag & drop videos here, or click to select'}
      </p>
      <p className="mt-1 text-xs text-gray-500">
        Supports MP4, MOV, and WebM formats
      </p>
    </div>
  );
};

export default DropzoneArea;
