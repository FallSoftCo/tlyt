'use client'

import { useState, useEffect } from 'react'
import { Loader2, Video, FileText, Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

interface AnalysisLoadingProps {
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

export function AnalysisLoading({ chipCost }: AnalysisLoadingProps) {
  const [currentStage, setCurrentStage] = useState(0)
  const [progress, setProgress] = useState(0)
  const [elapsedTime, setElapsedTime] = useState(0)


  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedTime(prev => prev + 0.1)
      
      // Linear progress over 1 minute, cap at 90%
      const newProgress = Math.min(90, (elapsedTime / 60) * 100)
      setProgress(newProgress)

      // Change stages at 20s and 40s
      if (elapsedTime > 20 && currentStage === 0) {
        setCurrentStage(1)
      } else if (elapsedTime > 40 && currentStage === 1) {
        setCurrentStage(2)
      }
    }, 100)

    return () => clearInterval(interval)
  }, [elapsedTime, currentStage])

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
            {Math.round(elapsedTime)}s / ~60s
          </span>
        </div>

        <div className="text-xs text-muted-foreground">
          <p>Analysis takes about 1 minute. Our AI is carefully processing your video.</p>
        </div>
      </div>
    </div>
  )
}