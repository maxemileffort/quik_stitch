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

  // Function to fetch jobs, modified to handle polling updates
  const fetchJobs = async (isPollingUpdate = false) => {
    if (!user) {
      if (!isPollingUpdate) { // Only set main error if it's the initial load
        setError("Please log in to view your dashboard.");
        setInitialLoading(false);
      }
      return;
    }

    if (!isPollingUpdate) {
      setInitialLoading(true);
      setError(null);
    }
    setPollingError(null); // Clear polling error on each attempt

    try {
      const response = await apiClient.get<Job[]>('/jobs');
      setJobs(response.data);

      // Check if polling should continue
      const hasActiveJobs = response.data.some(job => job.status === 'QUEUED' || job.status === 'PROCESSING');
      if (!hasActiveJobs && pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
        console.log("Polling stopped: No active jobs.");
      } else if (hasActiveJobs && !pollingIntervalRef.current) {
        // Start polling if it wasn't running but now there are active jobs
        startPolling();
      }

    } catch (err: any) {
      console.error("Error fetching jobs:", err);
      const errorMessage = err.response?.data?.error || "Failed to fetch jobs.";
      if (isPollingUpdate) {
        setPollingError(errorMessage); // Set polling error without disrupting UI much
      } else {
        setError(errorMessage); // Set main error for initial load failure
      }
    } finally {
      if (!isPollingUpdate) {
        setInitialLoading(false);
      }
    }
  };

  // Function to start polling
  const startPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current); // Clear existing interval if any
    }
    console.log("Starting polling...");
    pollingIntervalRef.current = setInterval(() => {
      console.log("Polling for job updates...");
      fetchJobs(true); // Pass true to indicate it's a polling update
    }, 5000); // Poll every 5 seconds
  };

  // Effect for initial fetch and setting up/tearing down polling
  useEffect(() => {
    if (user) {
      fetchJobs().then(() => {
         // Start polling immediately after initial fetch if active jobs exist
         if (jobs.some(job => job.status === 'QUEUED' || job.status === 'PROCESSING')) {
            startPolling();
         }
      });
    } else {
       // Ensure loading is false and error is set if user logs out/isn't logged in
       setInitialLoading(false);
       setError("Please log in to view your dashboard.");
       setJobs([]); // Clear jobs if user logs out
    }

    // Cleanup function to clear interval on component unmount or user change
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
        console.log("Polling stopped: Component unmounted or user changed.");
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]); // Re-run effect if user changes

   // Effect to start/stop polling based on job status changes after initial load
   useEffect(() => {
    if (!initialLoading && user) {
        const hasActiveJobs = jobs.some(job => job.status === 'QUEUED' || job.status === 'PROCESSING');
        if (hasActiveJobs && !pollingIntervalRef.current) {
            startPolling();
        } else if (!hasActiveJobs && pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
            console.log("Polling stopped: No active jobs remaining.");
        }
    }
   // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [jobs, initialLoading, user]);


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
