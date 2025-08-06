// app/actions.ts
'use server'

// Import only what's needed
import {
  getSignInUrl,
  getSignUpUrl,
  withAuth,
  signOut,
} from '@workos-inc/authkit-nextjs';
import { prisma } from '../lib/prisma';
import { extractVideoId, fetchVideoMetadata, mapYouTubeDataToVideo } from '../lib/youtube';
import type { Video, Analysis } from '../lib/generated/prisma';

// WorkOS Authentication functions
export const handleSignOutAction = async () => {
  // Use NEXT_PUBLIC_BASE_URL if available, otherwise construct from protocol and VERCEL_URL
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 
    `${process.env.VERCEL_ENV === "development" ? "http://" : "https://"}${process.env.VERCEL_URL || "localhost:3256"}`;
  
  // Set the returnTo parameter to redirect the user back to the application after sign out
  await signOut({returnTo: baseUrl});
}

export const getSignInUrlAction = async () => {
  return await getSignInUrl();
}

export const getSignUpUrlAction = async () => {
  return await getSignUpUrl();
}

/**
 * Check if the user is still authenticated
 * Returns user info if authenticated, null otherwise
 */
export const checkAuthAction = async () => {
  try {
    const { user } = await withAuth();
    return user;
  } catch (error) {
    console.error('Error checking auth:', error);
    return null;
  }
}

/**
 * Upsert a YouTube video - creates new or updates existing video record
 * Chip cost is automatically calculated based on video duration:
 * - 1 chip = 30 minutes of video
 * - Videos ≤30 minutes = 1 chip
 * - Videos >30 minutes = Math.ceil(duration_minutes / 30) chips
 * @param youtubeUrl - YouTube video URL
 * @param chipCost - Optional manual chip cost (if not provided, calculated from duration)
 * @returns Video record or error
 */
export const upsertVideoAction = async (youtubeUrl: string, chipCost?: number): Promise<{
  success: boolean;
  video?: Video;
  error?: string;
}> => {
  try {
    // Validate input
    if (!youtubeUrl || typeof youtubeUrl !== 'string') {
      return { success: false, error: 'Invalid YouTube URL provided' };
    }

    if (chipCost !== undefined && (chipCost < 1 || !Number.isInteger(chipCost))) {
      return { success: false, error: 'Invalid chip cost provided - must be a positive integer ≥1' };
    }

    // Extract video ID from URL
    const videoId = extractVideoId(youtubeUrl);
    if (!videoId) {
      return { success: false, error: 'Invalid YouTube URL format' };
    }

    // Check if video already exists in database
    const existingVideo = await prisma.video.findUnique({
      where: { youtubeId: videoId }
    });

    // Fetch fresh metadata from YouTube API
    const youtubeData = await fetchVideoMetadata(videoId);
    if (!youtubeData) {
      return { success: false, error: 'Video not found on YouTube' };
    }

    // Transform YouTube data to our model format
    const videoData = mapYouTubeDataToVideo(youtubeData, chipCost);

    let video: Video;

    if (existingVideo) {
      // Update existing video with fresh data
      video = await prisma.video.update({
        where: { youtubeId: videoId },
        data: {
          ...videoData,
          // Keep original creation date
          createdAt: existingVideo.createdAt
        }
      });
    } else {
      // Create new video record
      video = await prisma.video.create({
        data: videoData
      });
    }

    return { success: true, video };

  } catch (error) {
    console.error('Error in upsertVideoAction:', error);
    
    // Handle specific error types
    if (error instanceof Error) {
      if (error.message.includes('YouTube API')) {
        return { success: false, error: 'Failed to fetch video data from YouTube' };
      }
      if (error.message.includes('YouTube API key not configured')) {
        return { success: false, error: 'YouTube API not properly configured' };
      }
    }

    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Analyze a YouTube video using Gemini Flash 2.0 API with 0.5 FPS processing
 * Creates an Analysis record in the database with structured results
 * @param youtubeId - YouTube video ID
 * @param requestId - Associated request ID
 * @param userId - User ID who requested the analysis
 * @returns Analysis record or error
 */
export const analyzeVideoWithGemini = async (
  youtubeId: string,
  requestId: string,
  userId: string
): Promise<{
  success: boolean;
  analysis?: Analysis;
  error?: string;
}> => {
  try {
    // Input validation
    if (!youtubeId || typeof youtubeId !== 'string') {
      return { success: false, error: 'Invalid YouTube ID provided' };
    }
    if (!requestId || typeof requestId !== 'string') {
      return { success: false, error: 'Invalid request ID provided' };
    }
    if (!userId || typeof userId !== 'string') {
      return { success: false, error: 'Invalid user ID provided' };
    }

    // Check for API key
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return { success: false, error: 'Gemini API key not configured' };
    }

    // Construct API endpoint
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    // Build request payload
    const requestPayload = {
      contents: [{
        parts: [
          {
            fileData: {
              mimeType: "video/mp4",
              fileUri: `https://www.youtube.com/watch?v=${youtubeId}`
            }
          },
          {
            text: "Analyze this video comprehensively. Provide a detailed summary, identify key moments with precise timestamps, and create a concise TL;DR. Focus on main topics, important transitions, and actionable insights."
          }
        ]
      }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            summary: {
              type: "STRING",
              description: "Comprehensive video summary"
            },
            tldr: {
              type: "STRING",
              description: "Concise TL;DR summary"
            },
            timestampSeconds: {
              type: "ARRAY",
              items: { type: "INTEGER" },
              description: "Array of timestamp positions in seconds"
            },
            timestampDescriptions: {
              type: "ARRAY",
              items: { type: "STRING" },
              description: "Array of descriptions for each timestamp"
            }
          },
          required: ["summary", "tldr", "timestampSeconds", "timestampDescriptions"]
        }
      }
    };

    // Make API call
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestPayload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', response.status, errorText);
      return { 
        success: false, 
        error: `Gemini API error: ${response.status} - ${errorText}` 
      };
    }

    const apiResponse = await response.json();
    
    // Extract structured content from API response
    if (!apiResponse.candidates || !apiResponse.candidates[0] || !apiResponse.candidates[0].content) {
      return { success: false, error: 'Invalid response from Gemini API' };
    }

    const content = apiResponse.candidates[0].content.parts[0].text;
    const analysisData = JSON.parse(content);

    // Validate response structure
    if (!analysisData.summary || !analysisData.tldr || 
        !Array.isArray(analysisData.timestampSeconds) || 
        !Array.isArray(analysisData.timestampDescriptions)) {
      return { success: false, error: 'Invalid analysis data structure from API' };
    }

    // Ensure timestamp arrays are the same length
    if (analysisData.timestampSeconds.length !== analysisData.timestampDescriptions.length) {
      return { success: false, error: 'Timestamp arrays length mismatch' };
    }

    // Create Analysis record in database
    const analysis = await prisma.analysis.create({
      data: {
        userId,
        videoId: youtubeId,
        summary: analysisData.summary,
        tldr: analysisData.tldr,
        timestampSeconds: analysisData.timestampSeconds,
        timestampDescriptions: analysisData.timestampDescriptions
      }
    });

    return { success: true, analysis };

  } catch (error) {
    console.error('Error in analyzeVideoWithGemini:', error);
    
    // Handle specific error types
    if (error instanceof SyntaxError) {
      return { success: false, error: 'Failed to parse API response' };
    }
    if (error instanceof Error) {
      if (error.message.includes('fetch')) {
        return { success: false, error: 'Network error connecting to Gemini API' };
      }
      if (error.message.includes('Prisma')) {
        return { success: false, error: 'Database error creating analysis record' };
      }
    }

    return { success: false, error: 'An unexpected error occurred during video analysis' };
  }
}