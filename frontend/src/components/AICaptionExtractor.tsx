import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wand2, X, Loader2 } from 'lucide-react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { supabase } from '../lib/supabase'; // Import Supabase client
import { useAuth } from '../contexts/AuthContext'; // Import useAuth
import AuthModal from './AuthModal'; // Import AuthModal
import { toast } from 'react-toastify'; // Import toast

// Define a basic structure for the expected caption format
interface CaptionData {
  startTime: string; // e.g., "00:00:00.000"
  endTime: string;   // e.g., "00:00:05.123"
  text: string;
}

interface AICaptionExtractorProps {
  videos: File[];
  // Add an onComplete prop if the parent needs the result
  // onExtractionComplete: (captions: any) => void;
}

function AICaptionExtractor({ videos }: AICaptionExtractorProps) {
  const navigate = useNavigate(); // Or get navigate from props if preferred
  const { user } = useAuth(); // Get user from AuthContext
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false); // State for AuthModal
  const [isProcessing, setIsProcessing] = useState(false);
  const [ffmpegLoading, setFfmpegLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ffmpegRef = useRef<FFmpeg | null>(null);
  const ffmpegLoaded = useRef(false); // Prevent multiple loads

  const loadFFmpeg = async () => {
    if (ffmpegLoaded.current || ffmpegLoading) return;
    setFfmpegLoading(true);
    setError(null);
    ffmpegRef.current = new FFmpeg();
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
    try {
      await ffmpegRef.current.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });
      ffmpegLoaded.current = true;
      console.log('FFmpeg loaded successfully');
    } catch (err) {
      console.error('Error loading FFmpeg:', err);
      setError('Failed to load resources needed for AI extraction. Please try refreshing.');
      ffmpegRef.current = null;
    } finally {
      setFfmpegLoading(false);
    }
  };

  // Load FFmpeg when the component mounts
  useEffect(() => {
    loadFFmpeg();
  }, []);

  const handleAIExtraction = async () => {
    // --- Add Authentication Check ---
    if (!user) {
      setIsAuthModalOpen(true);
      return; // Stop if not logged in
    }
    // --- Add Paid User Check ---
    if (!user.isPaidUser) {
      toast.info("AI caption extraction is available for VIP members. Please upgrade your plan on the Pricing page.");
      return; // Stop if not a paid user
    }
    // --- End Paid User Check ---

    if (!ffmpegRef.current || !ffmpegLoaded.current) {
      setError('AI processing resources are not ready. Please wait or try refreshing.');
      return;
    }
    if (!videos || videos.length === 0) {
      setError('No video files found to process.');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const ffmpeg = ffmpegRef.current;
      const videoFile = videos[0]; // Process first video
      const inputFilename = `input_${videoFile.name}`;
      const outputFilename = `output_${Date.now()}.aac`;

      console.log(`Writing ${inputFilename} to FFmpeg FS...`);
      await ffmpeg.writeFile(inputFilename, await fetchFile(videoFile));

      console.log(`Starting audio extraction for ${inputFilename}...`);
      await ffmpeg.exec(['-i', inputFilename, '-vn', '-acodec', 'copy', outputFilename]);
      console.log(`Audio extraction finished. Reading ${outputFilename}...`);

      const audioData = await ffmpeg.readFile(outputFilename);
      const audioBlob = new Blob([audioData], { type: 'audio/aac' });

      console.log('Audio extracted successfully:', audioBlob);
      console.log('Invoking Supabase function whisper-transcribe...');
      const { data: functionData, error: functionError } = await supabase.functions.invoke(
        'whisper-transcribe',
        {
          body: audioBlob, // Send the audio blob directly
        }
      );

      if (functionError) {
        console.error('Supabase function error:', functionError);
        throw new Error(`Transcription failed: ${functionError.message}`);
      }

      if (!functionData) {
         throw new Error('Transcription failed: No data returned from function.');
      }

      // Assuming the function returns the OpenAI response directly
      // And the transcription text is in a 'text' field (standard Whisper response)
      const transcriptionText = functionData.text;
      if (typeof transcriptionText !== 'string') {
        console.error('Unexpected response format:', functionData);
        throw new Error('Transcription failed: Unexpected response format from server.');
      }

      console.log('Transcription received:', transcriptionText);

      // Basic formatting: Create a single caption entry for the whole text
      // TODO: Enhance this if the backend provides timestamped segments
      const processedCaptions: CaptionData[] = [{
        startTime: '00:00:00.000', // Placeholder start time
        endTime: '00:00:00.000',   // Placeholder end time (needs video duration ideally)
        text: transcriptionText,
      }];

      // Navigate to preview page with the extracted captions
      navigate('/preview', { state: { videos, captions: processedCaptions, captionSource: 'auto' } });

      // Optional cleanup
      // await ffmpeg.deleteFile(inputFilename);
      // await ffmpeg.deleteFile(outputFilename);

    } catch (err) {
      console.error('Error during AI caption extraction:', err);
      setError(`An error occurred during processing: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div>
      {/* Render AuthModal */}
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />

      <button
        onClick={handleAIExtraction}
        disabled={isProcessing || ffmpegLoading || !ffmpegLoaded.current}
        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {isProcessing && 'Processing...'}
        {ffmpegLoading && !isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {ffmpegLoading && !isProcessing && 'Loading Resources...'}
        {!isProcessing && !ffmpegLoading && 'Extract Captions with AI'}
      </button>
      {ffmpegLoading && (
         <p className="mt-2 text-sm text-gray-500">Initializing AI engine...</p>
      )}
      {error && (
        <div className="mt-4 rounded-md bg-red-50 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <X className="h-5 w-5 text-red-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AICaptionExtractor;
