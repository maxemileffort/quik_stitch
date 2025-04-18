import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom'; // Import useParams and useNavigate
import { useAuth } from '../contexts/AuthContext';
import AuthModal from '../components/AuthModal';
import CaptionEditor, { CaptionSegment } from '../components/Captions/CaptionEditor';
import apiClient from '../lib/apiClient'; // Import API client
import { supabase } from '../lib/supabase'; // Import Supabase client
import { Loader2 } from 'lucide-react'; // Import Loader

// Define Job interface matching Dashboard's
interface Job {
  id: string;
  userId: string;
  type: 'STITCHING' | 'TRANSCRIPTION';
  status: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  inputFile: string | null;
  outputFile: string | null; // This holds the storage path
  createdAt: string;
  updatedAt: string;
  videoId: string | null;
  errorMessage?: string | null;
}

// Hardcode bucket name - REFACTOR LATER
const OUTPUT_BUCKET_NAME = 'uploads';

function Preview() {
  const { jobId } = useParams<{ jobId: string }>(); // Get jobId from URL
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [job, setJob] = useState<Job | null>(null); // State for the fetched job
  const [videoUrl, setVideoUrl] = useState<string | null>(null); // Signed URL for the video
  const [captions, setCaptions] = useState<CaptionSegment[]>([]); // State for captions
   const [isLoading, setIsLoading] = useState(true);
   const [error, setError] = useState<string | null>(null);
   const [isSaving, setIsSaving] = useState(false); // State for save operation
   const [saveError, setSaveError] = useState<string | null>(null); // State for save error

   // Handler for updating captions from the editor
  const handleCaptionsChange = (updatedCaptions: CaptionSegment[]) => {
    setCaptions(updatedCaptions);
    // TODO: Implement saving edited captions (e.g., PATCH /api/jobs/:jobId/captions)
     console.log("Captions updated:", updatedCaptions);
   };

   // Function to save captions
   const handleSaveCaptions = async () => {
     if (!jobId || !job || job.type !== 'TRANSCRIPTION') {
       setSaveError("Cannot save captions for this job.");
       return;
     }
     if (!user) {
       setIsAuthModalOpen(true); // Should not happen if button is disabled, but check
       return;
     }

     setIsSaving(true);
     setSaveError(null);

     try {
       // Assuming the editor provides the full text in the first segment for now
       // If the editor handles multiple segments, this needs adjustment to combine them.
       const captionText = captions.map(c => c.text).join('\n'); // Simple join for now

       await apiClient.patch(`/jobs/${jobId}/captions`, { captions: captionText });

       // Optionally update local job state if backend returns updated job
       // setJob(response.data);
       console.log("Captions saved successfully!");
       // Maybe show a success toast using react-toastify
       // toast.success("Captions saved!");

     } catch (err: any) {
       console.error("Error saving captions:", err);
       const message = err.response?.data?.error || err.message || "Failed to save captions.";
       setSaveError(message);
       // Maybe show an error toast
       // toast.error(`Save failed: ${message}`);
     } finally {
       setIsSaving(false);
     }
   };

   // Function to handle video export (downloads the video from the signed URL)
  const handleExport = () => {
    if (!user) {
      setIsAuthModalOpen(true);
      return;
    }
    if (!videoUrl) {
      console.error("No video URL available for export.");
      setError("Cannot export: Video URL not loaded.");
      return;
    }

    // Use the existing signed URL for download
    const link = document.createElement('a');
    link.href = videoUrl;
    // Try to extract a reasonable filename
    const filename = job?.outputFile?.split('/').pop() || `quikstitch-export-${jobId}.mp4`;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    console.log("Export triggered for:", videoUrl);
  };

  // Effect to fetch job details and generate video URL
  useEffect(() => {
    let isMounted = true; // Prevent state updates on unmounted component

    const fetchJobAndVideoUrl = async () => {
      if (!jobId) {
        setError("No Job ID specified.");
        setIsLoading(false);
        return;
      }
      if (!user) {
         // Should be protected by router, but check anyway
         setError("Please log in to view this page.");
         setIsLoading(false);
         return;
      }

      setIsLoading(true);
      setError(null);
      setVideoUrl(null);
      setJob(null);
      setCaptions([]); // Clear previous captions

      try {
        // 1. Fetch job details from the backend
        const response = await apiClient.get<Job>(`/jobs/${jobId}`); // Assuming GET /api/jobs/:id exists
        const fetchedJob = response.data;

        if (!isMounted) return;

        if (!fetchedJob || fetchedJob.status !== 'COMPLETED' || !fetchedJob.outputFile) {
          setError("Job not found, not completed, or has no output file.");
          setJob(fetchedJob); // Still set job data if found, even if not usable
          setIsLoading(false);
          return;
        }

        setJob(fetchedJob);

        // 2. Generate signed URL for the video
        console.log(`Generating signed URL for: ${fetchedJob.outputFile}`);
        const { data: urlData, error: urlError } = await supabase.storage
          .from(OUTPUT_BUCKET_NAME)
          .createSignedUrl(fetchedJob.outputFile, 3600); // URL valid for 1 hour

        if (!isMounted) return;

        if (urlError) {
          console.error("Error generating signed URL:", urlError);
          throw new Error(`Failed to get video URL: ${urlError.message}`);
        }
        if (!urlData?.signedUrl) {
           throw new Error("Failed to get signed URL (empty data).");
        }

        console.log("Signed URL generated successfully:", urlData.signedUrl);

        // 3. Fetch video data from signed URL and create Blob URL to bypass COEP
        console.log("Fetching video data from signed URL...");
        const videoResponse = await fetch(urlData.signedUrl);
        if (!videoResponse.ok) {
          throw new Error(`Failed to fetch video data: ${videoResponse.status} ${videoResponse.statusText}`);
        }
        const videoBlob = await videoResponse.blob();
        const blobUrl = URL.createObjectURL(videoBlob);
        console.log("Blob URL created:", blobUrl);

        if (!isMounted) { // Check again after async fetch
           URL.revokeObjectURL(blobUrl); // Clean up if unmounted during fetch
           return;
        }
         setVideoUrl(blobUrl); // Use Blob URL for the video player

         // 4. Load Captions if job type is TRANSCRIPTION
         if (fetchedJob.type === 'TRANSCRIPTION') {
             if (fetchedJob.outputFile && typeof fetchedJob.outputFile === 'string') {
                 console.log("Loading transcription text from job.outputFile");
                 // Basic parsing: Treat the whole text as one segment for now
                 // TODO: Enhance this if the backend provides timestamped segments
                 const initialCaptions: CaptionSegment[] = [
                     {
                         id: 1, // Simple ID
                         startTime: 0, // Placeholder start time
                         endTime: 1,   // Placeholder end time (needs adjustment if timestamps available)
                         text: fetchedJob.outputFile,
                     }
                 ];
                 setCaptions(initialCaptions);
             } else {
                 console.log("Transcription job has no outputFile content.");
                 setCaptions([]); // Set empty if no text
             }
         } else {
              console.log("Job type is STITCHING, not loading captions from outputFile.");
              setCaptions([]); // No captions for stitching jobs (unless fetched separately later)
         }

       } catch (err: any) {
        console.error("Error fetching job details or video URL:", err);
        if (isMounted) {
          setError(err.response?.data?.error || err.message || "Failed to load preview.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchJobAndVideoUrl();

    // Cleanup function
    return () => {
      isMounted = false;
      // Revoke Blob URL on cleanup
      if (videoUrl && videoUrl.startsWith('blob:')) {
        console.log("Revoking Blob URL:", videoUrl);
        URL.revokeObjectURL(videoUrl);
      }
    };
  }, [jobId, user]); // Re-fetch if jobId or user changes

  return (
    <div className="container mx-auto px-4 py-8">
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />

      <h1 className="text-3xl font-bold text-gray-900 mb-4">Preview & Edit Job</h1>
      <button onClick={() => navigate('/dashboard')} className="text-sm text-blue-600 hover:underline mb-6">
        &larr; Back to Dashboard
      </button>

      <div className="bg-white rounded-lg shadow-md p-6 min-h-[400px]">
        {isLoading ? (
          <div className="flex justify-center items-center py-10">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            <span className="ml-3 text-gray-600">Loading Job Details...</span>
          </div>
        ) : error ? (
          <div className="text-center py-10">
             <p className="text-red-600 font-semibold">Error loading preview:</p>
             <p className="text-red-500 mt-1">{error}</p>
          </div>
        ) : videoUrl && job ? (
          <div className="w-full">
            <h2 className="text-xl font-semibold text-gray-800 mb-2">
              Job ID: <span className="font-mono text-sm bg-gray-100 px-1 rounded">{job.id}</span>
            </h2>
            <p className="text-sm text-gray-500 mb-4">Status: {job.status}</p>

            {/* Video Player - Key added to force re-render on URL change */}
            <video key={videoUrl} src={videoUrl} controls className="w-full rounded shadow-lg mb-6 max-h-[600px]">
              Your browser does not support the video tag or the video URL is invalid.
             </video>

             {/* Caption Editor and Save Button (conditionally rendered) */}
             {job.type === 'TRANSCRIPTION' && captions.length > 0 && (
               <> {/* Wrap editor and save button */}
                 <CaptionEditor
                   captions={captions}
                   onCaptionsChange={handleCaptionsChange}
                 />
                 {/* Save Button and Error Display */}
                 <div className="mt-4 text-right">
                   {saveError && <p className="text-red-500 text-sm mb-2">{saveError}</p>}
                   <button
                     onClick={handleSaveCaptions}
                     disabled={isSaving}
                     className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                   >
                     {isSaving ? (
                       <Loader2 className="h-4 w-4 animate-spin mr-2" />
                     ) : null}
                     {isSaving ? 'Saving...' : 'Save Captions'}
                   </button>
                 </div>
               </>
             )}

             {/* Export Button */}
            <div className="mt-8 text-center border-t pt-6">
              <button
                className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                onClick={handleExport}
              >
                {/* TODO: Change text/action if captions need saving before export */}
                Download Original Output
              </button>
              {/* TODO: Add a "Save Captions & Re-process" button? */}
            </div>
          </div>
        ) : (
          <p className="text-gray-500 text-center py-10">Job data could not be loaded.</p> // Fallback if no error but no data
        )}
      </div>
    </div>
  );
}

export default Preview;
