import React, { useState } from 'react';
// Removed useNavigate import
import { Upload as UploadIcon, X, Download } from 'lucide-react';

interface ManualCaptionUploaderProps {
  videos: File[]; // Keep videos prop if needed for context, or remove if unused
  // Callback function to pass the validated captions file to the parent
  onUploadComplete: (captionsFile: File) => void;
}

// Add onUploadComplete to props destructuring
function ManualCaptionUploader({ videos, onUploadComplete }: ManualCaptionUploaderProps) {
  // Removed navigate state
  const [error, setError] = useState<string | null>(null);

  const validateCSV = (file: File): Promise<boolean> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        if (!text) {
          reject('Could not read file content.');
          return;
        }
        const lines = text.split('\n').filter(line => line.trim() !== ''); // Ignore empty lines
        if (lines.length < 2) {
          reject('File is empty or has no data rows');
          return;
        }

        const headers = lines[0].toLowerCase().trim().split(',').map(h => h.trim());
        const requiredFields = ['start_time', 'end_time', 'text'];
        
        // Check if headers contain required fields (allowing for variations like 'start time')
        const hasRequiredFields = requiredFields.every(field => 
          headers.includes(field) || headers.includes(field.replace('_', ''))
        );

        if (!hasRequiredFields) {
          reject('CSV file must contain start_time, end_time, and text columns');
          return;
        }

        // Optional: Add more validation for row data format if needed

        resolve(true);
      };
      reader.onerror = () => reject('Error reading file');
      reader.readAsText(file);
    });
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setError(null);
    
    if (file) {
      try {
        await validateCSV(file);
        // Pass the validated file to the parent component via the callback
        onUploadComplete(file);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    }
  };

  const downloadTemplate = () => {
    const template = 'start_time,end_time,text\n00:00:00,00:00:05,"First caption"\n00:00:05,00:00:10,"Second caption"';
    const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'captions_template.csv';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label htmlFor="csv-upload" className="block text-sm font-medium text-gray-700">
          Upload CSV File
        </label>
        <button
          type="button"
          onClick={downloadTemplate}
          className="inline-flex items-center text-sm text-blue-600 hover:text-blue-500"
        >
          <Download className="h-4 w-4 mr-1" />
          Download Template
        </button>
      </div>
      <input
        id="csv-upload"
        name="csv-upload"
        type="file"
        accept=".csv,text/csv"
        onChange={handleFileUpload}
        className="mt-1 block w-full text-sm text-gray-500
          file:mr-4 file:py-2 file:px-4
          file:rounded-md file:border-0
          file:text-sm file:font-medium
          file:bg-blue-50 file:text-blue-700
          hover:file:bg-blue-100"
      />
      {error && (
        <div className="mt-2 rounded-md bg-red-50 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <X className="h-5 w-5 text-red-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-red-800">{error}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ManualCaptionUploader;
