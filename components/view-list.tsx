'use client'

import { ViewCard } from './view-card'
import type { View, Video, Analysis } from '@/lib/generated/prisma'

interface ViewListProps {
  views: View[]
  videos: Video[]
  analyses: Analysis[]
  userId: string
  isAuthenticated?: boolean
  chipBalance?: number
  onAnalysisRequested?: () => void
}

export function ViewList({ views, videos, analyses, userId, isAuthenticated = false, chipBalance, onAnalysisRequested }: ViewListProps) {
  // Create lookup maps for efficient data retrieval
  const videoMap = new Map(videos.map(video => [video.id, video]))
  const analysisMap = new Map(analyses.map(analysis => [analysis.id, analysis]))

  // Function to get video for a view
  const getVideoForView = (view: View): Video | undefined => {
    const videoId = view.videoIds[0] // Assuming first video ID
    return videoId ? videoMap.get(videoId) : undefined
  }

  // Function to get analysis for a view
  const getAnalysisForView = (view: View): Analysis | undefined => {
    const analysisId = view.analysisIds[0] // Assuming first analysis ID
    return analysisId ? analysisMap.get(analysisId) : undefined
  }

  if (views.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No videos in your history yet</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {views.map(view => {
        const video = getVideoForView(view)
        const analysis = getAnalysisForView(view)
        
        // Skip views without associated videos
        if (!video) {
          return null
        }

        return (
          <ViewCard
            key={view.id}
            view={view}
            video={video}
            analysis={analysis}
            userId={userId}
            isAuthenticated={isAuthenticated}
            chipBalance={chipBalance}
            onAnalysisRequested={onAnalysisRequested}
          />
        )
      })}
    </div>
  )
}