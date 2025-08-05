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
import type { Video } from '../lib/generated/prisma';

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