export interface YouTubeVideoData {
  id: string;
  snippet: {
    title: string;
    description: string;
    channelId: string;
    channelTitle: string;
    publishedAt: string;
    tags?: string[];
    categoryId: string;
    defaultLanguage?: string;
    defaultAudioLanguage?: string;
  };
  contentDetails: {
    duration: string;
    dimension?: string;
    definition?: string;
    licensedContent?: boolean;
  };
  statistics?: {
    viewCount?: string;
    likeCount?: string;
    commentCount?: string;
  };
  status?: {
    privacyStatus?: string;
  };
}

export interface VideoCreateInput {
  youtubeId: string;
  title: string;
  description?: string;
  channelId: string;
  channelTitle: string;
  publishedAt: Date;
  duration: string;
  tags: string[];
  categoryId?: string;
  defaultLanguage?: string;
  defaultAudioLanguage?: string;
  dimension?: string;
  definition?: string;
  viewCount?: bigint;
  likeCount?: bigint;
  commentCount?: bigint;
  privacyStatus?: string;
  licensedContent?: boolean;
  chipCost: number;
}

/**
 * Extract YouTube video ID from various URL formats
 */
export function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([^&\n?#]+)/,
    /youtube\.com\/watch\?.*v=([^&\n?#]+)/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return null;
}

/**
 * Fetch video metadata from YouTube Data API
 */
export async function fetchVideoMetadata(videoId: string): Promise<YouTubeVideoData | null> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  
  if (!apiKey) {
    throw new Error('YouTube API key not configured');
  }

  const url = `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&key=${apiKey}&part=snippet,contentDetails,statistics,status`;

  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`YouTube API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.items || data.items.length === 0) {
      return null; // Video not found
    }

    return data.items[0] as YouTubeVideoData;
  } catch (error) {
    console.error('Error fetching YouTube video metadata:', error);
    throw error;
  }
}

/**
 * Parse ISO 8601 duration format to total minutes
 * @param duration ISO 8601 duration string (e.g., "PT4M13S", "PT1H30M45S")
 * @returns Duration in minutes
 */
export function parseISO8601Duration(duration: string): number {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) {
    throw new Error(`Invalid ISO 8601 duration format: ${duration}`);
  }

  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);

  return hours * 60 + minutes + seconds / 60;
}

/**
 * Parse ISO 8601 duration format to total seconds
 * @param duration ISO 8601 duration string (e.g., "PT4M13S", "PT1H30M45S")
 * @returns Duration in seconds
 */
export function parseISO8601DurationToSeconds(duration: string): number {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) {
    throw new Error(`Invalid ISO 8601 duration format: ${duration}`);
  }

  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);

  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Calculate chip cost based on video duration
 * - 1 chip = 30 minutes of video
 * - Videos ≤30 minutes = 1 chip (e.g., 5min = 1 chip, 30min = 1 chip)
 * - Videos >30 minutes = rounded up (e.g., 31min = 2 chips, 60min = 2 chips, 61min = 3 chips)
 * @param duration ISO 8601 duration string
 * @returns Number of chips needed (minimum 1 chip)
 */
export function calculateChipCost(duration: string): number {
  const durationMinutes = parseISO8601Duration(duration);
  const chipsNeeded = Math.ceil(durationMinutes / 30); // Round up to nearest chip
  return Math.max(1, chipsNeeded); // Minimum 1 chip for any video
}

/**
 * Transform YouTube API data to match Prisma Video model
 */
export function mapYouTubeDataToVideo(data: YouTubeVideoData, chipCost?: number): VideoCreateInput {
  // Calculate chip cost automatically if not provided
  const calculatedChipCost = chipCost ?? calculateChipCost(data.contentDetails.duration);
  
  return {
    youtubeId: data.id,
    title: data.snippet.title,
    description: data.snippet.description || undefined,
    channelId: data.snippet.channelId,
    channelTitle: data.snippet.channelTitle,
    publishedAt: new Date(data.snippet.publishedAt),
    duration: data.contentDetails.duration,
    tags: data.snippet.tags || [],
    categoryId: data.snippet.categoryId || undefined,
    defaultLanguage: data.snippet.defaultLanguage || undefined,
    defaultAudioLanguage: data.snippet.defaultAudioLanguage || undefined,
    dimension: data.contentDetails.dimension || undefined,
    definition: data.contentDetails.definition || undefined,
    viewCount: data.statistics?.viewCount ? BigInt(data.statistics.viewCount) : undefined,
    likeCount: data.statistics?.likeCount ? BigInt(data.statistics.likeCount) : undefined,
    commentCount: data.statistics?.commentCount ? BigInt(data.statistics.commentCount) : undefined,
    privacyStatus: data.status?.privacyStatus || undefined,
    licensedContent: data.contentDetails.licensedContent || undefined,
    chipCost: calculatedChipCost
  };
}