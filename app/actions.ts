// app/actions.ts
'use server'

// Import only what's needed
import {
  getSignInUrl,
  getSignUpUrl,
  withAuth,
  signOut,
} from '@workos-inc/authkit-nextjs';
import { revalidatePath } from 'next/cache';
import { prisma } from '../lib/prisma';
import { extractVideoId, fetchVideoMetadata, mapYouTubeDataToVideo, parseISO8601DurationToSeconds } from '../lib/youtube';
import { logger } from '../lib/logger';
import type { Video, Analysis, View, User, History, Request, Transaction, ChipPackage } from '../lib/generated/prisma';

// WorkOS Authentication functions
export const handleSignOutAction = async () => {
  // Get the base URL for the application
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 
    `${process.env.VERCEL_ENV === "development" ? "http://" : "https://"}${process.env.VERCEL_URL || "localhost:3256"}`;
  
  // Set the returnTo parameter to redirect the user back to the application after sign out
  await signOut({returnTo: baseUrl});
}

export const getSignInUrlAction = async () => {
  return await getSignInUrl({
    redirectUri: process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI
  });
}

export const getSignUpUrlAction = async () => {
  return await getSignUpUrl({
    redirectUri: process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI
  });
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
 * @param videoDuration - Video duration in ISO 8601 format (e.g., "PT4M13S")
 * @param userPrompt - Optional additional instructions from user
 * @returns Analysis record or error
 */
export const analyzeVideoWithGemini = async (
  youtubeId: string,
  requestId: string,
  userId: string,
  videoDuration: string,
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
            text: (() => {
              const durationInSeconds = parseISO8601DurationToSeconds(videoDuration);
              
              // Generate 10 evenly distributed timestamps with small jitter
              const baseInterval = durationInSeconds / 11; // 11 intervals for 10 timestamps
              const structuredTimestamps = [];
              for (let i = 1; i <= 10; i++) {
                const baseTime = Math.floor(i * baseInterval);
                // Add small jitter (±5% of interval, max ±10 seconds)
                const jitter = Math.floor((Math.random() - 0.5) * Math.min(baseInterval * 0.1, 20));
                const timestamp = Math.max(5, Math.min(durationInSeconds - 5, baseTime + jitter));
                structuredTimestamps.push(timestamp);
              }
              structuredTimestamps.sort((a, b) => a - b); // Ensure sorted
              
              const defaultPrompt = `Analyze this video comprehensively. Provide a detailed summary and create a concise TL;DR.\n\nThis video is ${durationInSeconds} seconds long. Provide timestamps in TWO categories:\n\n1. STRUCTURED TIMESTAMPS: Analyze what happens at these 10 specific times (with jitter for natural distribution):\n${structuredTimestamps.map(t => `- ${t} seconds`).join('\n')}\n\n2. CONTENT-DRIVEN TIMESTAMPS: Additionally, identify up to 7 truly significant moments (key transitions, important points, dramatic changes) with their exact timestamps. These should be genuinely meaningful moments you determine, not just arbitrary times.\n\nFor ALL timestamps, describe what's happening, key points being made, or important transitions. Ensure all timestamps are between 0 and ${durationInSeconds} seconds and are sorted chronologically.`;
              
              return userPrompt 
                ? `${defaultPrompt}\n\nAdditional instructions: ${userPrompt}`
                : defaultPrompt;
            })()
          },
          {
            fileData: {
              fileUri: `https://www.youtube.com/watch?v=${youtubeId}`
            }
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
            timestamps: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  seconds: {
                    type: "INTEGER",
                    description: "Timestamp position in seconds"
                  },
                  description: {
                    type: "STRING", 
                    description: "Description of what happens at this timestamp"
                  },
                  type: {
                    type: "STRING",
                    enum: ["structured", "content-driven"],
                    description: "Whether this is a requested structured timestamp or a content-driven significant moment"
                  }
                },
                required: ["seconds", "description", "type"]
              },
              description: "Array of timestamp objects (10 structured + up to 7 content-driven), sorted chronologically"
            }
          },
          required: ["summary", "tldr", "timestamps"]
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
    console.log('Raw Gemini response content:', content);
    
    let analysisData;
    try {
      analysisData = JSON.parse(content);
      console.log('Parsed analysis data:', analysisData);
    } catch (error) {
      console.error('JSON parse error:', error);
      return { success: false, error: 'Failed to parse Gemini API response as JSON' };
    }

    // Validate response structure
    if (!analysisData.summary || !analysisData.tldr || !Array.isArray(analysisData.timestamps)) {
      console.error('Invalid analysis data structure:', analysisData);
      return { success: false, error: 'Invalid analysis data structure from API' };
    }

    // Transform timestamp objects into separate arrays for database storage
    const durationInSeconds = parseISO8601DurationToSeconds(videoDuration);
    
    const timestampSeconds: number[] = [];
    const timestampDescriptions: string[] = [];
    let structuredCount = 0;
    let contentDrivenCount = 0;
    
    for (const timestamp of analysisData.timestamps) {
      if (typeof timestamp.seconds === 'number' && typeof timestamp.description === 'string') {
        // Validate timestamp is within video duration
        if (timestamp.seconds >= 0 && timestamp.seconds <= durationInSeconds) {
          timestampSeconds.push(timestamp.seconds);
          timestampDescriptions.push(timestamp.description);
          
          // Track timestamp types for logging
          if (timestamp.type === 'structured') {
            structuredCount++;
          } else if (timestamp.type === 'content-driven') {
            contentDrivenCount++;
          }
        } else {
          console.warn(`Skipping out-of-bounds timestamp: ${timestamp.seconds}s (video is ${durationInSeconds}s)`);
        }
      }
    }
    
    console.log(`Received ${structuredCount} structured timestamps and ${contentDrivenCount} content-driven timestamps`);
    console.log('Transformed timestamps:', { timestampSeconds, timestampDescriptions });

    // Create Analysis record in database
    console.log('Creating analysis record in database...');
    const analysis = await prisma.analysis.create({
      data: {
        userId,
        videoId: youtubeId,
        summary: analysisData.summary,
        tldr: analysisData.tldr,
        timestampSeconds: timestampSeconds,
        timestampDescriptions: timestampDescriptions
      }
    });
    console.log('Analysis record created:', analysis.id);

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
 * Submit YouTube link for unauthenticated users (trial users with rate limiting)
 * Creates video and view models, with 15-minute rate limit based on previous requests
 * @param youtubeUrl - YouTube video URL
 * @param userIdentifier - Trial user identifier
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

    // Rate limiting check for trial users (15 minutes)
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    const recentRequests = await prisma.request.findMany({
      where: {
        userId: userIdentifier,
        createdAt: {
          gte: fifteenMinutesAgo
        }
      }
    });

    if (recentRequests.length > 0) {
      return { 
        success: false, 
        error: 'Rate limit exceeded. You can only make one request per 15 minutes. Sign up for unlimited access!' 
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
 * For authenticated users: finds by WorkOS ID or upgrades existing unauthenticated user
 * For unauthenticated users: creates new User record
 * @param existingUserId - Optional existing user ID from cookie for upgrade scenarios
 * @returns User info, authentication status, and associated history
 */
export const initializeUser = async (existingUserId?: string): Promise<{
  success: boolean;
  isAuthenticated: boolean;
  user?: User;
  history?: History;
  error?: string;
}> => {
  console.log('=== initializeUser called ===', { existingUserId });
  
  try {
    // Check if user is authenticated via WorkOS
    let workosUser = null;
    try {
      const authResult = await withAuth();
      workosUser = authResult.user;
      console.log('✅ WorkOS user found:', workosUser ? { id: workosUser.id, email: workosUser.email } : null);
    } catch {
      console.log('ℹ️  No WorkOS authentication found');
    }

    if (workosUser) {
      // Handle authenticated user
      console.log('✅ Processing authenticated WorkOS user');
      
      // First, try to find existing user by WorkOS ID
      let user = await prisma.user.findUnique({
        where: { workosId: workosUser.id }
      });

      if (user) {
        // Update existing authenticated user with latest info
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
      } else if (existingUserId) {
        // Try to upgrade existing unauthenticated user
        const existingUser = await prisma.user.findUnique({
          where: { id: existingUserId }
        });

        if (!existingUser) {
          // Cookie points to non-existent user - data inconsistency
          // Create new user and let page.tsx handle cookie update
          user = await prisma.user.create({
            data: {
              workosId: workosUser.id,
              email: workosUser.email,
              name: workosUser.firstName && workosUser.lastName 
                ? `${workosUser.firstName} ${workosUser.lastName}`
                : workosUser.firstName || workosUser.lastName || undefined
            }
          });
        } else if (!existingUser.workosId) {
          // Upgrade the existing user with WorkOS data
          user = await prisma.user.update({
            where: { id: existingUserId },
            data: {
              workosId: workosUser.id,
              email: workosUser.email,
              name: workosUser.firstName && workosUser.lastName 
                ? `${workosUser.firstName} ${workosUser.lastName}`
                : workosUser.firstName || workosUser.lastName || undefined,
              updatedAt: new Date()
            }
          });
        } else {
          // Existing user is already authenticated with different WorkOS account
          // This shouldn't happen in normal flow, but handle gracefully
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
      } else {
        // No existing user, create new authenticated user
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

      console.log('🎉 Returning authenticated user:', { 
        userId: user.id, 
        workosId: user.workosId, 
        email: user.email,
        isAuthenticated: true 
      });
      
      return { 
        success: true, 
        isAuthenticated: true, 
        user, 
        history 
      };

    } else {
      // Handle unauthenticated user - simply create a new user record
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

/**
 * Get complete user data including history, views, videos, and analyses
 * @param userId - ID of the user whose data to fetch
 * @returns Complete user state or error
 */
export const getUserData = async (userId: string): Promise<{
  success: boolean;
  user?: User;
  history?: History;
  views?: View[];
  videos?: Video[];
  analyses?: Analysis[];
  error?: string;
}> => {
  try {
    // Input validation
    if (!userId || typeof userId !== 'string') {
      return { success: false, error: 'Invalid user ID provided' };
    }

    // Get user record
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return { success: false, error: 'User not found' };
    }

    // Get user's history
    const history = await prisma.history.findFirst({
      where: { userId: userId }
    });

    if (!history) {
      return { success: false, error: 'History not found for user' };
    }

    // Get all views for this user
    const views = await prisma.view.findMany({
      where: { userId: userId },
      orderBy: { createdAt: 'desc' }
    });

    // Collect all unique video IDs from views
    const videoIds = Array.from(new Set(views.flatMap(view => view.videoIds)));
    
    // Get all videos
    const videos = videoIds.length > 0 ? await prisma.video.findMany({
      where: { id: { in: videoIds } }
    }) : [];

    // Collect all unique analysis IDs from views
    const analysisIds = Array.from(new Set(views.flatMap(view => view.analysisIds)));
    
    // Get all analyses
    const analyses = analysisIds.length > 0 ? await prisma.analysis.findMany({
      where: { id: { in: analysisIds } }
    }) : [];

    return {
      success: true,
      user,
      history,
      views,
      videos,
      analyses
    };

  } catch (error) {
    console.error('Error in getUserData:', error);
    
    // Handle specific error types
    if (error instanceof Error) {
      if (error.message.includes('Prisma')) {
        return { success: false, error: 'Database error occurred' };
      }
    }

    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Request free analysis for unauthenticated users (RATE LIMITING TEMPORARILY DISABLED)
 * Creates Request record, triggers analysis, and updates View atomically
 * @param viewId - ID of the view to analyze
 * @param userId - User ID making the request
 * @param userPrompt - Optional additional instructions from user
 * @returns Request and Analysis records or error
 */
export const requestFreeAnalysis = async (
  viewId: string,
  userId: string,
  userPrompt?: string
): Promise<{
  success: boolean;
  request?: Request;
  analysis?: Analysis;
  view?: View;
  error?: string;
}> => {
  try {
    // Input validation
    if (!viewId || typeof viewId !== 'string') {
      return { success: false, error: 'Invalid view ID provided' };
    }
    if (!userId || typeof userId !== 'string') {
      return { success: false, error: 'Invalid user ID provided' };
    }

    // Get the view and validate it belongs to the user
    const existingView = await prisma.view.findUnique({
      where: { id: viewId }
    });

    if (!existingView) {
      return { success: false, error: 'View not found' };
    }

    if (existingView.userId !== userId) {
      return { success: false, error: 'View does not belong to user' };
    }

    // Check if view already has an analysis
    if (existingView.analysisIds.length > 0) {
      return { success: false, error: 'View already has analysis' };
    }

    // Rate limiting check for trial users (15 minutes)
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    const recentRequests = await prisma.request.findMany({
      where: {
        userId: userId,
        createdAt: {
          gte: fifteenMinutesAgo
        }
      }
    });

    if (recentRequests.length > 0) {
      return { 
        success: false, 
        error: 'Rate limit exceeded. You can only make one analysis request per 15 minutes. Sign up for unlimited access!' 
      };
    }

    // Get video record ID from view
    const videoRecordId = existingView.videoIds[0];
    if (!videoRecordId) {
      return { success: false, error: 'No video associated with view' };
    }

    // Get the video record to get the YouTube ID
    const videoRecord = await prisma.video.findUnique({
      where: { id: videoRecordId }
    });

    if (!videoRecord) {
      return { success: false, error: 'Video record not found' };
    }

    // Create Request record
    const request = await prisma.request.create({
      data: {
        userId: userId,
        userPrompt: userPrompt || null,
        videoIds: [videoRecordId],
        analysisIds: [] // Will be populated after analysis
      }
    });

    // Trigger analysis using YouTube ID
    const analysisResult = await analyzeVideoWithGemini(
      videoRecord.youtubeId, // Use YouTube ID for analysis
      request.id,
      userId,
      videoRecord.duration, // Pass video duration
      userPrompt
    );

    if (!analysisResult.success || !analysisResult.analysis) {
      // Clean up request if analysis failed
      await prisma.request.delete({ where: { id: request.id } });
      return {
        success: false,
        error: analysisResult.error || 'Analysis failed'
      };
    }

    const analysis = analysisResult.analysis;

    // Update request with analysis ID
    const updatedRequest = await prisma.request.update({
      where: { id: request.id },
      data: {
        analysisIds: [analysis.id]
      }
    });

    // Update view with request and analysis IDs
    const updatedView = await prisma.view.update({
      where: { id: viewId },
      data: {
        requestIds: [...existingView.requestIds, request.id],
        analysisIds: [...existingView.analysisIds, analysis.id]
      }
    });

    // Revalidate the page to show fresh data
    try {
      revalidatePath('/');
    } catch (error) {
      // Continue anyway - don't fail the whole operation if revalidation fails
      logger.error(`Error revalidating path: ${error}`);
    }
    
    return {
      success: true,
      request: updatedRequest,
      analysis,
      view: updatedView
    };

  } catch (error) {
    console.error('Error in requestFreeAnalysis:', error);
    
    // Handle specific error types
    if (error instanceof Error) {
      if (error.message.includes('Prisma')) {
        return { success: false, error: 'Database error occurred' };
      }
    }

    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Get specific analysis by ID
 * @param analysisId - ID of the analysis to fetch
 * @returns Analysis record or error
 */
export const getAnalysis = async (analysisId: string): Promise<{
  success: boolean;
  analysis?: Analysis;
  error?: string;
}> => {
  try {
    // Input validation
    if (!analysisId || typeof analysisId !== 'string') {
      return { success: false, error: 'Invalid analysis ID provided' };
    }

    // Get analysis record
    const analysis = await prisma.analysis.findUnique({
      where: { id: analysisId }
    });

    if (!analysis) {
      return { success: false, error: 'Analysis not found' };
    }

    return { success: true, analysis };

  } catch (error) {
    console.error('Error in getAnalysis:', error);
    
    // Handle specific error types
    if (error instanceof Error) {
      if (error.message.includes('Prisma')) {
        return { success: false, error: 'Database error occurred' };
      }
    }

    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Get recent transactions for a user
 * @param userId - User ID to get transactions for
 * @param limit - Number of transactions to return (default: 10)
 * @returns Recent transactions or error
 */
export const getRecentTransactions = async (
  userId: string,
  limit: number = 10
): Promise<{
  success: boolean;
  transactions?: Transaction[];
  error?: string;
}> => {
  try {
    // Input validation
    if (!userId || typeof userId !== 'string') {
      return { success: false, error: 'Invalid user ID provided' };
    }

    if (limit < 1 || limit > 100) {
      return { success: false, error: 'Limit must be between 1 and 100' };
    }

    // Get recent transactions
    const transactions = await prisma.transaction.findMany({
      where: { userId: userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        package: true
      }
    });

    return { success: true, transactions };

  } catch (error) {
    console.error('Error in getRecentTransactions:', error);
    
    // Handle specific error types
    if (error instanceof Error) {
      if (error.message.includes('Prisma')) {
        return { success: false, error: 'Database error occurred' };
      }
    }

    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Get all active chip packages
 * @returns Active chip packages or error
 */
export const getActiveChipPackages = async (): Promise<{
  success: boolean;
  packages?: ChipPackage[];
  error?: string;
}> => {
  try {
    // Get active packages sorted by sort order
    const packages = await prisma.chipPackage.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' }
    });

    return { success: true, packages };

  } catch (error) {
    console.error('Error in getActiveChipPackages:', error);
    
    // Handle specific error types
    if (error instanceof Error) {
      if (error.message.includes('Prisma')) {
        return { success: false, error: 'Database error occurred' };
      }
    }

    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Check if user has sufficient chips for analysis
 * @param userId - User ID to check
 * @param chipCost - Number of chips required
 * @returns Whether user has sufficient chips
 */
export const checkChipBalance = async (
  userId: string,
  chipCost: number
): Promise<{
  success: boolean;
  hasSufficientChips?: boolean;
  currentBalance?: number;
  error?: string;
}> => {
  try {
    // Input validation
    if (!userId || typeof userId !== 'string') {
      return { success: false, error: 'Invalid user ID provided' };
    }

    if (chipCost < 1 || !Number.isInteger(chipCost)) {
      return { success: false, error: 'Invalid chip cost provided' };
    }

    // Get user's current chip balance
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { chipBalance: true }
    });

    if (!user) {
      return { success: false, error: 'User not found' };
    }

    const hasSufficientChips = user.chipBalance >= chipCost;

    return {
      success: true,
      hasSufficientChips,
      currentBalance: user.chipBalance
    };

  } catch (error) {
    console.error('Error in checkChipBalance:', error);
    
    // Handle specific error types
    if (error instanceof Error) {
      if (error.message.includes('Prisma')) {
        return { success: false, error: 'Database error occurred' };
      }
    }

    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Deduct chips from user balance and create transaction record
 * @param userId - User ID to deduct chips from
 * @param chipAmount - Number of chips to deduct
 * @param description - Description of the transaction
 * @param videoId - Optional video ID if for analysis
 * @returns Transaction record or error
 */
export const deductChips = async (
  userId: string,
  chipAmount: number,
  description: string,
  videoId?: string
): Promise<{
  success: boolean;
  transaction?: Transaction;
  newBalance?: number;
  error?: string;
}> => {
  try {
    // Input validation
    if (!userId || typeof userId !== 'string') {
      return { success: false, error: 'Invalid user ID provided' };
    }

    if (chipAmount < 1 || !Number.isInteger(chipAmount)) {
      return { success: false, error: 'Invalid chip amount provided' };
    }

    if (!description || typeof description !== 'string') {
      return { success: false, error: 'Invalid description provided' };
    }

    // Use transaction to ensure atomicity
    const result = await prisma.$transaction(async (tx) => {
      // Get current user balance
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { chipBalance: true }
      });

      if (!user) {
        throw new Error('User not found');
      }

      if (user.chipBalance < chipAmount) {
        throw new Error('Insufficient chip balance');
      }

      // Update user balance
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          chipBalance: user.chipBalance - chipAmount
        }
      });

      // Create transaction record
      const transaction = await tx.transaction.create({
        data: {
          userId,
          type: 'DEDUCTION',
          chipAmount: -chipAmount, // Negative for spending
          description,
          videoId
        }
      });

      return { transaction, newBalance: updatedUser.chipBalance };
    });

    return {
      success: true,
      transaction: result.transaction,
      newBalance: result.newBalance
    };

  } catch (error) {
    console.error('Error in deductChips:', error);
    
    // Handle specific error types
    if (error instanceof Error) {
      if (error.message === 'Insufficient chip balance') {
        return { success: false, error: 'Insufficient chip balance' };
      }
      if (error.message === 'User not found') {
        return { success: false, error: 'User not found' };
      }
      if (error.message.includes('Prisma')) {
        return { success: false, error: 'Database error occurred' };
      }
    }

    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Request analysis for authenticated users (chip-based)
 * Checks user authentication, chip balance, deducts chips, creates Request record, 
 * triggers analysis, and updates View atomically
 * @param viewId - ID of the view to analyze
 * @param userId - User ID making the request
 * @param userPrompt - Optional additional instructions from user
 * @returns Request and Analysis records or error
 */
export const requestAnalysisAuthenticated = async (
  viewId: string,
  userId: string,
  userPrompt?: string
): Promise<{
  success: boolean;
  request?: Request;
  analysis?: Analysis;
  view?: View;
  error?: string;
}> => {
  try {
    // Input validation
    if (!viewId || typeof viewId !== 'string') {
      return { success: false, error: 'Invalid view ID provided' };
    }
    if (!userId || typeof userId !== 'string') {
      return { success: false, error: 'Invalid user ID provided' };
    }

    // Check if user is authenticated
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { workosId: true, chipBalance: true }
    });

    if (!user) {
      return { success: false, error: 'User not found' };
    }

    if (!user.workosId) {
      return { success: false, error: 'User not authenticated' };
    }

    // Get the view and validate it belongs to the user
    const existingView = await prisma.view.findUnique({
      where: { id: viewId }
    });

    if (!existingView) {
      return { success: false, error: 'View not found' };
    }

    if (existingView.userId !== userId) {
      return { success: false, error: 'View does not belong to user' };
    }

    // Check if view already has an analysis
    if (existingView.analysisIds.length > 0) {
      return { success: false, error: 'View already has analysis' };
    }

    // Get video record to determine chip cost
    const videoRecordId = existingView.videoIds[0];
    if (!videoRecordId) {
      return { success: false, error: 'No video associated with view' };
    }

    const videoRecord = await prisma.video.findUnique({
      where: { id: videoRecordId }
    });

    if (!videoRecord) {
      return { success: false, error: 'Video record not found' };
    }

    const chipCost = videoRecord.chipCost;

    // Check chip balance
    if (user.chipBalance < chipCost) {
      const needed = chipCost - user.chipBalance;
      return { 
        success: false, 
        error: `You need ${needed} more chip${needed !== 1 ? 's' : ''} to analyze this video. You have ${user.chipBalance} chip${user.chipBalance !== 1 ? 's' : ''} but need ${chipCost}.` 
      };
    }

    // Deduct chips first (before analysis to prevent duplicate charges)
    const deductResult = await deductChips(
      userId, 
      chipCost, 
      `Video analysis: ${videoRecord.title}`, 
      videoRecord.id
    );

    if (!deductResult.success) {
      return { 
        success: false, 
        error: deductResult.error || 'Failed to deduct chips' 
      };
    }

    // Create Request record
    const request = await prisma.request.create({
      data: {
        userId: userId,
        userPrompt: userPrompt || null,
        videoIds: [videoRecordId],
        analysisIds: [] // Will be populated after analysis
      }
    });

    // Trigger analysis using YouTube ID
    const analysisResult = await analyzeVideoWithGemini(
      videoRecord.youtubeId, // Use YouTube ID for analysis
      request.id,
      userId,
      videoRecord.duration, // Pass video duration
      userPrompt
    );

    if (!analysisResult.success || !analysisResult.analysis) {
      // Analysis failed - refund chips atomically
      await prisma.$transaction(async (tx) => {
        // Refund chips to user
        await tx.user.update({
          where: { id: userId },
          data: {
            chipBalance: { increment: chipCost }
          }
        });
        
        // Create refund transaction record
        await tx.transaction.create({
          data: {
            userId,
            type: 'REFUND',
            chipAmount: chipCost,
            description: `Refund: Analysis failed for ${videoRecord.title}`,
            videoId: videoRecord.id
          }
        });
      });

      // Clean up request
      await prisma.request.delete({ where: { id: request.id } });
      
      return {
        success: false,
        error: analysisResult.error || 'Analysis failed (chips refunded)'
      };
    }

    const analysis = analysisResult.analysis;

    // Update request with analysis ID
    const updatedRequest = await prisma.request.update({
      where: { id: request.id },
      data: {
        analysisIds: [analysis.id]
      }
    });

    // Update view with request and analysis IDs
    const updatedView = await prisma.view.update({
      where: { id: viewId },
      data: {
        requestIds: [...existingView.requestIds, request.id],
        analysisIds: [...existingView.analysisIds, analysis.id]
      }
    });

    // Revalidate the page to show fresh data
    try {
      revalidatePath('/');
    } catch (error) {
      // Continue anyway - don't fail the whole operation if revalidation fails
      logger.error(`Error revalidating path: ${error}`);
    }
    
    return {
      success: true,
      request: updatedRequest,
      analysis,
      view: updatedView
    };

  } catch (error) {
    console.error('Error in requestAnalysisAuthenticated:', error);
    
    // Handle specific error types
    if (error instanceof Error) {
      if (error.message.includes('Prisma')) {
        return { success: false, error: 'Database error occurred' };
      }
    }

    return { success: false, error: 'An unexpected error occurred' };
  }
}
