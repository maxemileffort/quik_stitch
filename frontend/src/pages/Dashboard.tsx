import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom'; // Import useNavigate
import { useAuth } from '../contexts/AuthContext';
import { Loader2, Trash2, Download, Eye } from 'lucide-react'; // Import Eye icon
import apiClient from '../lib/apiClient';
import { toast } from 'react-toastify';
import { supabase } from '../lib/supabase'; // Import frontend Supabase client

// Hardcode bucket name - REFACTOR LATER (e.g., use env var)
const OUTPUT_BUCKET_NAME = 'uploads';

// Define the structure of a Job object based on Prisma schema
interface Job {
  id: string;
  userId: string;
  type: 'STITCHING' | 'TRANSCRIPTION';
  status: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  inputFile: string | null;
  outputFile: string | null;
  createdAt: string;
  updatedAt: string;
  videoId: string | null;
  errorMessage?: string | null;
}

// Removed local apiClient setup

function Dashboard() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [initialLoading, setInitialLoading] = useState(true); // Renamed for clarity
  const [pollingError, setPollingError] = useState<string | null>(null); // Separate error state for polling
  const [error, setError] = useState<string | null>(null); // Keep for initial load error
  const [deletingJobId, setDeletingJobId] = useState<string | null>(null); // State to track deletion
  const [downloadingJobId, setDownloadingJobId] = useState<string | null>(null); // State for download loading
  // Remove previewingJobId state - loading handled on Preview page
  // const [previewingJobId, setPreviewingJobId] = useState<string | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null); // Ref to store interval ID
  const navigate = useNavigate(); // Initialize navigate hook

  // Function to fetch jobs specifically for polling updates
  const pollJobs = async () => {
    if (!user) return; // Don't poll if user logged out

    setPollingError(null); // Clear previous polling error
    try {
      console.log("Polling: Fetching jobs...");
      const response = await apiClient.get<Job[]>('/jobs');
      setJobs(response.data); // Update jobs state

      // Check if polling should continue based on fetched data
      const hasActiveJobs = response.data.some(job => job.status === 'QUEUED' || job.status === 'PROCESSING');
      if (!hasActiveJobs && pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
        console.log("Polling stopped: No active jobs found during poll.");
      }
      // No need to restart polling here, the interval continues if not cleared

    } catch (err: any) {
      console.error("Polling Error: Failed to fetch jobs:", err);
      const errorMessage = err.response?.data?.error || "Polling failed.";
      setPollingError(errorMessage);
      // Optionally stop polling on persistent errors?
      // if (pollingIntervalRef.current) {
      //   clearInterval(pollingIntervalRef.current);
      //   pollingIntervalRef.current = null;
      // }
    }
    // No finally block needed specifically for polling's loading state
  };


  // Function to start polling
  const startPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current); // Clear existing interval if any
     }
     console.log("Starting polling...");
     pollingIntervalRef.current = setInterval(() => {
       // Call the correct polling function
       pollJobs();
     }, 5000); // Poll every 5 seconds
   };

  // Effect for initial fetch
  useEffect(() => {
    let isMounted = true; // Prevent state updates if unmounted quickly

    if (user) {
      console.log("Dashboard: User found, initiating initial job fetch.");
      setInitialLoading(true); // Set loading true before fetch starts
      setError(null);
      setPollingError(null); // Clear any previous errors

      apiClient.get<Job[]>('/jobs')
        .then(response => {
          console.log("Dashboard: Initial job fetch successful.");
          if (isMounted) {
            setJobs(response.data);
            // Check if polling needs to start based on initial data
            const hasActiveJobs = response.data.some(job => job.status === 'QUEUED' || job.status === 'PROCESSING');
            if (hasActiveJobs) {
                startPolling(); // Start polling if needed
            }
          }
        })
        .catch(err => {
          console.error("Dashboard: Error fetching initial jobs:", err);
          if (isMounted) {
            setError(err.response?.data?.error || "Failed to fetch jobs.");
          }
        })
        .finally(() => {
          console.log("Dashboard: Initial job fetch attempt finished.");
          if (isMounted) {
            setInitialLoading(false); // Ensure loading is false after attempt
          }
        });
    } else {
       // Handle case where user is not logged in initially or logs out
       console.log("Dashboard: No user found, clearing state.");
       setInitialLoading(false);
       setError("Please log in to view your dashboard.");
       setJobs([]);
       // Ensure polling is stopped if user logs out
       if (pollingIntervalRef.current) {
         clearInterval(pollingIntervalRef.current);
         pollingIntervalRef.current = null;
       }
    }

    // Cleanup function for unmount or user change
    return () => {
      console.log("Dashboard: Cleaning up effect (unmount or user change).");
      isMounted = false;
      // Stop polling if it's running
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
        console.log("Polling stopped due to cleanup.");
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]); // Re-run only when user object changes


  // NOTE: The second useEffect for polling based on job changes is removed.
  // Polling is now started within the initial fetch's .then() block
  // and stopped either when no active jobs are found during a poll,
  // or during the cleanup of the main useEffect.


  // Function to handle job deletion
  const handleDeleteJob = async (jobId: string) => {
    if (deletingJobId) return; // Prevent multiple deletions at once

    setDeletingJobId(jobId);
    try {
      const response = await apiClient.delete(`/jobs/${jobId}`);
      if (response.status === 200) {
        setJobs(prevJobs => prevJobs.filter(job => job.id !== jobId));
        toast.success('Job deleted successfully.');
      } else {
        toast.error(response.data?.message || 'Failed to delete job.');
      }
    } catch (err: any) {
      console.error("Error deleting job:", err);
      toast.error(err.response?.data?.error || 'An error occurred while deleting the job.');
    } finally {
      setDeletingJobId(null);
    }
  };

  // Function to handle job download
  const handleDownloadJob = async (jobId: string, storagePath: string | null) => {
    if (!storagePath) {
      toast.error("No output file path found for this job.");
      return;
    }
    if (downloadingJobId) return; // Prevent multiple downloads at once

    setDownloadingJobId(jobId);
    try {
      // Generate a signed URL for download (expires in 60 seconds)
      const { data, error } = await supabase.storage
        .from(OUTPUT_BUCKET_NAME)
        .createSignedUrl(storagePath, 60, {
          download: true, // Force download behavior
        });

      if (error) {
        throw new Error(`Failed to create signed URL: ${error.message}`);
      }

      if (data?.signedUrl) {
        // Trigger download using a temporary link
        const link = document.createElement('a');
        link.href = data.signedUrl;
        // Extract filename from path for the download attribute
        link.download = storagePath.split('/').pop() || 'download.mp4';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success("Download started.");
      } else {
        throw new Error("Failed to get signed URL.");
      }
    } catch (err: any) {
      console.error("Error downloading job:", err);
      toast.error(err.message || 'An error occurred while preparing the download.');
    } finally {
      setDownloadingJobId(null);
    }
  };

  // Function to navigate to the preview page
  const handlePreviewJob = (jobId: string, storagePath: string | null) => {
    if (!storagePath) {
      toast.error("Job has no output file to preview.");
      return;
    }
    // Navigate to the preview route, passing jobId
    console.log(`Navigating to preview for job: ${jobId}`);
    navigate(`/preview/${jobId}`);
  };


  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Dashboard</h1>

      {/* Loading State (Only for initial load) */}
      {initialLoading && (
        <div className="flex justify-center items-center p-6">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          <span className="ml-2 text-gray-600">Loading jobs...</span>
        </div>
      )}

      {/* Error State (Initial Load Error) */}
      {error && !initialLoading && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
          <strong className="font-bold">Error: </strong>
          <span className="block sm:inline">{error}</span>
        </div>
      )}

       {/* Polling Error State (Subtle indicator) */}
       {pollingError && !initialLoading && (
         <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-2 rounded relative text-sm mb-4" role="alert">
           <span className="font-semibold">Note:</span> Could not refresh job status. Will retry automatically. ({pollingError})
         </div>
       )}


      {/* Job List */}
      {!initialLoading && !error && user && (
         <div className="bg-white rounded-lg shadow overflow-hidden">
           {jobs.length === 0 ? (
             <p className="text-gray-600 p-6 text-center">You haven't created any jobs yet.</p>
           ) : (
             <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Job Type
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                     <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Input File(s)
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created At
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {jobs.map((job) => (
                    <tr key={job.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{job.type}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {/* Add styling and tooltip for FAILED status. Add animation for PROCESSING */}
                        <div title={job.status === 'FAILED' && job.errorMessage ? job.errorMessage : undefined}>
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              job.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                              job.status === 'FAILED' ? 'bg-red-100 text-red-800 cursor-help' :
                              job.status === 'PROCESSING' ? 'bg-yellow-100 text-yellow-800 animate-pulse' : // Added animate-pulse
                              'bg-blue-100 text-blue-800' // QUEUED
                          }`}>
                            {job.status}
                            {/* TODO: Could add more granular progress here if backend provides it (e.g., percentage) */}
                          </span>
                        </div>
                      </td>
                       <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 truncate max-w-xs" title={job.inputFile ? JSON.stringify(JSON.parse(job.inputFile), null, 2) : 'N/A'}>
                        {/* Display input file info - assumes JSON string for now */}
                        {job.inputFile ? `${JSON.parse(job.inputFile).length} file(s)` : 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(job.createdAt).toLocaleString()}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2"> {/* Added space-x-2 */}
                        {/* Download Button */}
                        {job.status === 'COMPLETED' && job.outputFile && (
                          <button
                            onClick={() => handleDownloadJob(job.id, job.outputFile)}
                            disabled={downloadingJobId === job.id}
                            className="inline-flex items-center px-2.5 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {downloadingJobId === job.id ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-1" />
                            ) : (
                              <Download className="h-4 w-4 mr-1" />
                            )}
                            Download
                          </button>
                        )}
                        {/* Preview Button - Navigates */}
                        {job.status === 'COMPLETED' && job.outputFile && (
                          <button
                            onClick={() => handlePreviewJob(job.id, job.outputFile)}
                            // Disable only if deleting or downloading this specific job
                            disabled={deletingJobId === job.id || downloadingJobId === job.id}
                            className="inline-flex items-center px-2.5 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                             <Eye className="h-4 w-4 mr-1" />
                            Preview / Edit
                          </button>
                        )}
                        {/* Delete Button */}
                        <button
                          onClick={() => handleDeleteJob(job.id)}
                          disabled={deletingJobId === job.id || downloadingJobId === job.id} // Disable if deleting or downloading
                          className={`inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                          {deletingJobId === job.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                          <span className="ml-1">Delete</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
           )}
         </div>
      )}

       {/* Message for logged out users (handled by initial error state now) */}
       {/* {!initialLoading && !user && (
         <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded relative" role="alert">
            Please log in to view your dashboard.
         </div>
       )} */}
    </div>
  );
}

export default Dashboard;
