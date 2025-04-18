// frontend/src/components/Upload/UploadedFileList.tsx
import React from 'react';
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from 'react-beautiful-dnd';
import UploadedFileItem from './UploadedFileItem';
import { UploadedFile } from '../../hooks/useFileUploader'; // Adjust path

interface UploadedFileListProps {
  files: UploadedFile[];
  onRemoveFile: (id: string) => void;
  onReorderFiles: (files: UploadedFile[]) => void; // Callback to update state in parent
}

const UploadedFileList: React.FC<UploadedFileListProps> = ({
  files,
  onRemoveFile,
  onReorderFiles,
}) => {
  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) {
      return; // Dropped outside the list
    }

    const items = Array.from(files);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    onReorderFiles(items); // Update the state in the parent component
  };

  return (
    <div>
      <h3 className="text-lg font-medium text-gray-900 mb-4">
        Arrange Your Videos ({files.length})
      </h3>
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="uploadedFilesDroppable">
          {(provided) => (
            <div
              {...provided.droppableProps}
              ref={provided.innerRef}
              className="space-y-0" // Remove space-y-4 here, margin is on items
            >
              {files.map((file, index) => (
                <Draggable key={file.id} draggableId={file.id} index={index}>
                  {(providedDraggable, snapshot) => (
                    <UploadedFileItem
                      file={file}
                      provided={providedDraggable}
                      snapshot={snapshot}
                      onRemove={onRemoveFile}
                    />
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    </div>
  );
};

export default UploadedFileList;
