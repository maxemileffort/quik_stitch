import React from 'react';
import { Trash2 } from 'lucide-react';

// Define the structure for a single caption segment
export interface CaptionSegment {
  id: string | number; // Unique identifier for React keys and potential backend updates
  startTime: number; // Time in seconds
  endTime: number; // Time in seconds
  text: string;
}

interface CaptionEditorProps {
  captions: CaptionSegment[];
  onCaptionsChange: (updatedCaptions: CaptionSegment[]) => void; // Callback to update parent state
}

const CaptionEditor: React.FC<CaptionEditorProps> = ({ captions, onCaptionsChange }) => {

  // Handler for text changes in an input
  const handleTextChange = (id: string | number, newText: string) => {
    const updatedCaptions = captions.map(caption =>
      caption.id === id ? { ...caption, text: newText } : caption
    );
    onCaptionsChange(updatedCaptions);
  };

  // Handler for start time changes
  const handleStartTimeChange = (id: string | number, newTime: string) => {
    const timeInSeconds = parseFloat(newTime);
    if (!isNaN(timeInSeconds)) {
      const updatedCaptions = captions.map(caption =>
        caption.id === id ? { ...caption, startTime: timeInSeconds } : caption
      );
      onCaptionsChange(updatedCaptions);
    }
  };

  // Handler for end time changes
  const handleEndTimeChange = (id: string | number, newTime: string) => {
    const timeInSeconds = parseFloat(newTime);
    if (!isNaN(timeInSeconds)) {
      const updatedCaptions = captions.map(caption =>
        caption.id === id ? { ...caption, endTime: timeInSeconds } : caption
      );
      onCaptionsChange(updatedCaptions);
    }
  };

  // Handler for deleting a segment
  const handleDeleteSegment = (id: string | number) => {
    const updatedCaptions = captions.filter(caption => caption.id !== id);
    onCaptionsChange(updatedCaptions);
  };

  // Helper to format time (e.g., 123.45 -> "123.45")
  const formatTime = (timeInSeconds: number): string => {
    // Keep precision for editing
    return timeInSeconds.toFixed(2);
  };

  return (
    <div className="mt-8 border-t pt-6">
      <h3 className="text-xl font-semibold text-gray-800 mb-4">Edit Captions</h3>
      {captions.length === 0 ? (
        <p className="text-gray-500">No captions loaded.</p>
      ) : (
        <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
          {captions.map((caption) => (
            <div key={caption.id} className="flex items-start space-x-3 p-3 bg-gray-50 rounded border border-gray-200">
              {/* Time Inputs */}
              <div className="flex flex-col space-y-1 w-24">
                 <label htmlFor={`start-${caption.id}`} className="text-xs text-gray-500">Start (s)</label>
                 <input
                   id={`start-${caption.id}`}
                   type="number"
                   step="0.01"
                   min="0"
                   value={formatTime(caption.startTime)}
                   onChange={(e) => handleStartTimeChange(caption.id, e.target.value)}
                   className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-blue-500 focus:border-blue-500"
                 />
                 <label htmlFor={`end-${caption.id}`} className="text-xs text-gray-500">End (s)</label>
                 <input
                   id={`end-${caption.id}`}
                   type="number"
                   step="0.01"
                   min="0"
                   value={formatTime(caption.endTime)}
                   onChange={(e) => handleEndTimeChange(caption.id, e.target.value)}
                   className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-blue-500 focus:border-blue-500"
                 />
              </div>

              {/* Text Area */}
              <div className="flex-1">
                 <label htmlFor={`text-${caption.id}`} className="text-xs text-gray-500">Caption Text</label>
                 <textarea
                   id={`text-${caption.id}`}
                   value={caption.text}
                   onChange={(e) => handleTextChange(caption.id, e.target.value)}
                   rows={2}
                   className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-blue-500 focus:border-blue-500"
                 />
              </div>

              {/* Delete Button */}
              <button
                onClick={() => handleDeleteSegment(caption.id)}
                className="p-2 text-gray-400 hover:text-red-600 mt-4" // Align button roughly
                aria-label="Delete caption segment"
              >
                <Trash2 className="h-5 w-5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CaptionEditor;
