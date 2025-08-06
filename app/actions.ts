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
import type { Video, Analysis, View, User, History } from '../lib/generated/prisma';

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
 * @param userPrompt - Optional additional instructions from user
 * @returns Analysis record or error
 */
export const analyzeVideoWithGemini = async (
  youtubeId: string,
  requestId: string,
  userId: string,
  userPrompt?: string
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
            text: (() => {
              const defaultPrompt = "Analyze this video comprehensively. Provide a detailed summary, identify key moments with precise timestamps, and create a concise TL;DR. Focus on main topics, important transitions, and actionable insights.";
              return userPrompt 
                ? `${defaultPrompt}\n\nAdditional instructions: ${userPrompt}`
                : defaultPrompt;
            })()
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

/**
 * Submit YouTube link for unauthenticated users with rate limiting
 * Creates video and view models, with 1-hour rate limit based on previous requests
 * @param youtubeUrl - YouTube video URL
 * @param userIdentifier - User identifier (IP address, session ID, etc.)
 * @returns View and Video models or error
 */
export const submitYouTubeLinkUnauthenticated = async (
  youtubeUrl: string,
  userIdentifier: string
): Promise<{
  success: boolean;
  view?: View;
  video?: Video;
  error?: string;
}> => {
  try {
    // Input validation
    if (!youtubeUrl || typeof youtubeUrl !== 'string') {
      return { success: false, error: 'Invalid YouTube URL provided' };
    }
    if (!userIdentifier || typeof userIdentifier !== 'string') {
      return { success: false, error: 'Invalid user identifier provided' };
    }

    // Rate limiting check - look for requests in the last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentRequests = await prisma.request.findMany({
      where: {
        userId: userIdentifier,
        createdAt: {
          gte: oneHourAgo
        }
      }
    });

    if (recentRequests.length > 0) {
      return { 
        success: false, 
        error: 'Rate limit exceeded. You can only make one request per hour. Please try again later.' 
      };
    }

    // Process video using existing upsert action
    const videoResult = await upsertVideoAction(youtubeUrl);
    if (!videoResult.success || !videoResult.video) {
      return { 
        success: false, 
        error: videoResult.error || 'Failed to process video' 
      };
    }

    const video = videoResult.video;

    // Create View model
    const view = await prisma.view.create({
      data: {
        userId: userIdentifier,
        videoIds: [video.id],
        requestIds: [], // No request created yet
        analysisIds: [], // No analysis yet
        isExpanded: false
      }
    });

    // Find or create History model and add view
    const history = await prisma.history.findFirst({
      where: { userId: userIdentifier }
    });

    if (history) {
      // Update existing history
      await prisma.history.update({
        where: { id: history.id },
        data: {
          viewIds: [...history.viewIds, view.id],
          updatedAt: new Date()
        }
      });
    } else {
      // Create new history
      await prisma.history.create({
        data: {
          userId: userIdentifier,
          viewIds: [view.id],
          currentPositionIndex: 0,
          pageSize: 20
        }
      });
    }

    return { success: true, view, video };

  } catch (error) {
    console.error('Error in submitYouTubeLinkUnauthenticated:', error);
    
    // Handle specific error types
    if (error instanceof Error) {
      if (error.message.includes('Prisma')) {
        return { success: false, error: 'Database error occurred' };
      }
      if (error.message.includes('YouTube')) {
        return { success: false, error: 'Failed to process YouTube video' };
      }
    }

    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Initialize user - checks WorkOS authentication and creates/updates User and History records
 * Handles both authenticated users (via WorkOS) and unauthenticated users (via userIdentifier)
 * @param userIdentifier - For unauthenticated users (IP, session ID, etc.)
 * @returns User info, authentication status, and associated history
 */
export const initializeUser = async (userIdentifier?: string): Promise<{
  success: boolean;
  isAuthenticated: boolean;
  user?: User;
  history?: History;
  error?: string;
}> => {
  try {
    // Try to get authenticated user from WorkOS
    let workosUser = null;
    try {
      const authResult = await withAuth();
      workosUser = authResult.user;
    } catch {
      // User is not authenticated - this is expected for unauthenticated users
      console.log('User not authenticated via WorkOS');
    }

    if (workosUser) {
      // Handle authenticated user
      
      // Find or create User record by workosId
      let user = await prisma.user.findUnique({
        where: { workosId: workosUser.id }
      });

      if (user) {
        // Update existing user with latest info
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            email: workosUser.email,
            name: workosUser.firstName && workosUser.lastName 
              ? `${workosUser.firstName} ${workosUser.lastName}`
              : workosUser.firstName || workosUser.lastName || undefined,
            updatedAt: new Date()
          }
        });
      } else {
        // Create new user record
        user = await prisma.user.create({
          data: {
            workosId: workosUser.id,
            email: workosUser.email,
            name: workosUser.firstName && workosUser.lastName 
              ? `${workosUser.firstName} ${workosUser.lastName}`
              : workosUser.firstName || workosUser.lastName || undefined
          }
        });
      }

      // Find or create History record
      let history = await prisma.history.findFirst({
        where: { userId: user.id }
      });

      if (!history) {
        history = await prisma.history.create({
          data: {
            userId: user.id,
            viewIds: [],
            currentPositionIndex: 0,
            pageSize: 20
          }
        });
      }

      return { 
        success: true, 
        isAuthenticated: true, 
        user, 
        history 
      };

    } else {
      // Handle unauthenticated user
      if (!userIdentifier || typeof userIdentifier !== 'string') {
        return { 
          success: false, 
          isAuthenticated: false, 
          error: 'User identifier required for unauthenticated users' 
        };
      }

      // For unauthenticated users, create a minimal user record
      // We can use userIdentifier as a unique constraint or just create new records
      const user = await prisma.user.create({
        data: {
          workosId: null,
          email: null,
          name: null
        }
      });

      // Create History record linked to the user
      const history = await prisma.history.create({
        data: {
          userId: user.id,
          viewIds: [],
          currentPositionIndex: 0,
          pageSize: 20
        }
      });

      return { 
        success: true, 
        isAuthenticated: false, 
        user, 
        history 
      };
    }

  } catch (error) {
    console.error('Error in initializeUser:', error);
    
    // Handle specific error types
    if (error instanceof Error) {
      if (error.message.includes('Unique constraint')) {
        return { 
          success: false, 
          isAuthenticated: false, 
          error: 'User record conflict - please try again' 
        };
      }
      if (error.message.includes('Prisma')) {
        return { 
          success: false, 
          isAuthenticated: false, 
          error: 'Database error occurred' 
        };
      }
    }

    return { 
      success: false, 
      isAuthenticated: false, 
      error: 'An unexpected error occurred during user initialization' 
    };
  }
}

/**
 * Update view expansion state when user expands/collapses a view
 * @param viewId - ID of the view to update
 * @param isExpanded - New expansion state (true = expanded, false = collapsed)
 * @returns Updated view record or error
 */
export const updateViewExpansion = async (
  viewId: string,
  isExpanded: boolean
): Promise<{
  success: boolean;
  view?: View;
  error?: string;
}> => {
  try {
    // Input validation
    if (!viewId || typeof viewId !== 'string') {
      return { success: false, error: 'Invalid view ID provided' };
    }
    
    if (typeof isExpanded !== 'boolean') {
      return { success: false, error: 'Invalid expansion state provided' };
    }

    // Update the view record
    const view = await prisma.view.update({
      where: { id: viewId },
      data: {
        isExpanded: isExpanded,
        updatedAt: new Date()
      }
    });

    return { success: true, view };

  } catch (error) {
    console.error('Error in updateViewExpansion:', error);
    
    // Handle specific error types
    if (error instanceof Error) {
      if (error.message.includes('Record to update not found')) {
        return { success: false, error: 'View not found' };
      }
      if (error.message.includes('Prisma')) {
        return { success: false, error: 'Database error occurred' };
      }
    }

    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Update user's current position in their history
 * @param userId - ID of the user whose history to update
 * @param newPosition - New position index (0-based) in the viewIds array
 * @returns Updated history record or error
 */
export const updateHistoryPosition = async (
  userId: string,
  newPosition: number
): Promise<{
  success: boolean;
  history?: History;
  error?: string;
}> => {
  try {
    // Input validation
    if (!userId || typeof userId !== 'string') {
      return { success: false, error: 'Invalid user ID provided' };
    }
    
    if (typeof newPosition !== 'number' || newPosition < 0 || !Number.isInteger(newPosition)) {
      return { success: false, error: 'Invalid position provided - must be a non-negative integer' };
    }

    // Find the user's history record
    const existingHistory = await prisma.history.findFirst({
      where: { userId: userId }
    });

    if (!existingHistory) {
      return { success: false, error: 'History record not found for user' };
    }

    // Validate position is within bounds
    if (newPosition >= existingHistory.viewIds.length) {
      return { 
        success: false, 
        error: `Position ${newPosition} is out of bounds. History has ${existingHistory.viewIds.length} views.` 
      };
    }

    // Update the history record
    const history = await prisma.history.update({
      where: { id: existingHistory.id },
      data: {
        currentPositionIndex: newPosition,
        updatedAt: new Date()
      }
    });

    return { success: true, history };

  } catch (error) {
    console.error('Error in updateHistoryPosition:', error);
    
    // Handle specific error types
    if (error instanceof Error) {
      if (error.message.includes('Record to update not found')) {
        return { success: false, error: 'History record not found' };
      }
      if (error.message.includes('Prisma')) {
        return { success: false, error: 'Database error occurred' };
      }
    }

    return { success: false, error: 'An unexpected error occurred' };
  }
}