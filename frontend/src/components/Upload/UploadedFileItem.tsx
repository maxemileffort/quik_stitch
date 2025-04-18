// frontend/src/components/Upload/UploadedFileItem.tsx
import React from 'react';
import { DraggableProvided, DraggableStateSnapshot } from 'react-beautiful-dnd';
import { X, GripVertical, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { UploadedFile } from '../../hooks/useFileUploader'; // Adjust path as needed

interface UploadedFileItemProps {
  file: UploadedFile;
  provided: DraggableProvided; // From react-beautiful-dnd
  snapshot: DraggableStateSnapshot; // From react-beautiful-dnd
  onRemove: (id: string) => void;
}

const UploadedFileItem: React.FC<UploadedFileItemProps> = ({
  file,
  provided,
  snapshot,
  onRemove,
}) => {
  return (
    <div
      ref={provided.innerRef}
      {...provided.draggableProps} // Apply draggableProps to the main container
      className={`bg-white rounded-lg shadow p-4 flex items-center mb-4 ${
        snapshot.isDragging ? 'opacity-90 shadow-lg' : ''
      }`} // Add margin-bottom and dragging style
    >
      {/* Apply dragHandleProps ONLY to the handle */}
      <div {...provided.dragHandleProps} className="p-2 cursor-move mr-2 text-gray-500 hover:text-gray-700">
        <GripVertical className="h-5 w-5" />
      </div>
      {file.preview ? (
         <video
           className="w-32 h-20 object-cover rounded flex-shrink-0" // Added flex-shrink-0
           src={file.preview}
           preload="metadata" // Load only metadata initially for faster display
         />
       ) : (
         <div className="w-32 h-20 bg-gray-200 rounded flex-shrink-0 flex items-center justify-center text-gray-500">
           No Preview
         </div>
       )}
      <div className="ml-4 flex-1 min-w-0"> {/* Added min-w-0 for truncation */}
        <p className="text-sm font-medium text-gray-900 truncate" title={file.file.name}>
          {file.file.name}
        </p>
        <p className="text-sm text-gray-500">
          {(file.file.size / (1024 * 1024)).toFixed(2)} MB
        </p>
        {/* Status indicators */}
        <div className="mt-1 flex items-center text-xs">
          {file.status === 'uploading' && <Loader2 className="h-4 w-4 animate-spin mr-1 text-blue-500" />}
          {file.status === 'success' && <CheckCircle className="h-4 w-4 text-green-500 mr-1" />}
          {file.status === 'error' && <AlertCircle className="h-4 w-4 text-red-500 mr-1" />}
          <span className={`capitalize ${file.status === 'error' ? 'text-red-600' : 'text-gray-500'}`}>
            {file.status === 'error' ? (file.error || 'Upload failed') : file.status}
          </span>
        </div>
      </div>
      <button
        onClick={() => onRemove(file.id)}
        className="ml-4 p-2 text-gray-400 hover:text-red-600 flex-shrink-0" // Added flex-shrink-0
        aria-label={`Remove ${file.file.name}`}
      >
        <X className="h-5 w-5" />
      </button>
    </div>
  );
};

export default UploadedFileItem;
