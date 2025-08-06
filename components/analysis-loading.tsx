'use client'

import { useState, useEffect } from 'react'
import { Loader2, Video, FileText, Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

interface AnalysisLoadingProps {
  videoDuration?: string
  chipCost?: number
}

const LOADING_STAGES = [
  {
    icon: Video,
    message: "Analyzing video content...",
    duration: 3000
  },
  {
    icon: FileText,
    message: "Processing timestamps...",
    duration: 4000
  },
  {
    icon: Sparkles,
    message: "Generating summary...",
    duration: 3000
  }
] as const

export function AnalysisLoading({ videoDuration, chipCost }: AnalysisLoadingProps) {
  const [currentStage, setCurrentStage] = useState(0)
  const [progress, setProgress] = useState(0)
  const [elapsedTime, setElapsedTime] = useState(0)

  // Calculate estimated total time based on video duration (rough estimate)
  const getEstimatedTime = () => {
    if (!videoDuration) return 15 // Default 15 seconds
    
    // Parse duration string like "PT4M13S" or "PT1H2M10S"
    const match = videoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
    if (!match) return 15
    
    const hours = parseInt(match[1] || '0')
    const minutes = parseInt(match[2] || '0')
    const seconds = parseInt(match[3] || '0')
    const totalMinutes = hours * 60 + minutes + seconds / 60
    
    // Rough estimate: 3-5 seconds per minute of video, minimum 10 seconds
    return Math.max(10, Math.min(30, totalMinutes * 0.5))
  }

  const estimatedTime = getEstimatedTime()

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedTime(prev => prev + 0.1)
      
      // Update progress based on elapsed time and estimated total time
      const newProgress = Math.min(95, (elapsedTime / estimatedTime) * 100)
      setProgress(newProgress)

      // Change stages based on progress
      if (newProgress > 25 && currentStage === 0) {
        setCurrentStage(1)
      } else if (newProgress > 60 && currentStage === 1) {
        setCurrentStage(2)
      }
    }, 100)

    return () => clearInterval(interval)
  }, [elapsedTime, estimatedTime, currentStage])

  const CurrentIcon = LOADING_STAGES[currentStage].icon

  return (
    <div className="p-4 bg-muted/50 rounded-lg border border-muted">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <CurrentIcon className="w-4 h-4 text-primary animate-pulse" />
            <span className="font-medium text-sm">Analysis in Progress</span>
          </div>
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        </div>
        {chipCost && (
          <Badge variant="secondary" className="text-xs">
            {chipCost} chip{chipCost !== 1 ? 's' : ''}
          </Badge>
        )}
      </div>

      <div className="space-y-3">
        <div>
          <p className="text-sm text-muted-foreground mb-2">
            {LOADING_STAGES[currentStage].message}
          </p>
          <div className="w-full bg-muted/30 rounded-full h-2 overflow-hidden">
            <div 
              className="h-full bg-primary transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{Math.round(progress)}% complete</span>
          <span>
            {Math.round(elapsedTime)}s / ~{estimatedTime}s
          </span>
        </div>

        <div className="text-xs text-muted-foreground">
          <p>Our AI is carefully analyzing your video to provide the best insights.</p>
        </div>
      </div>
    </div>
  )
}