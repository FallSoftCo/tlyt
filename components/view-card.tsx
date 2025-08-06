'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ClockIcon, ChevronDownIcon, ChevronUpIcon } from 'lucide-react'
import { updateViewExpansion, requestFreeAnalysis } from '@/app/actions'
import { AnalysisLoading } from '@/components/analysis-loading'
import type { View, Video, Analysis } from '@/lib/generated/prisma'

interface ViewCardProps {
  view: View
  video: Video
  analysis?: Analysis
  userId: string
  onAnalysisRequested?: () => void
}

export function ViewCard({ view, video, analysis, userId, onAnalysisRequested }: ViewCardProps) {
  const router = useRouter()
  const [isExpanded, setIsExpanded] = useState(view.isExpanded)
  const [isRequestingAnalysis, setIsRequestingAnalysis] = useState(false)
  const [analysisError, setAnalysisError] = useState<string | null>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const formatDuration = (duration: string) => {
    // Duration is in ISO 8601 format like "PT4M13S" or "PT1H2M10S"
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
    if (!match) return duration
    
    const hours = parseInt(match[1] || '0')
    const minutes = parseInt(match[2] || '0')
    const seconds = parseInt(match[3] || '0')

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const formatTimestamp = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`
  }

  const handleToggleExpansion = async () => {
    const newExpanded = !isExpanded
    setIsExpanded(newExpanded)
    
    // Update server state
    await updateViewExpansion(view.id, newExpanded)
  }

  const handleRequestAnalysis = async () => {
    try {
      setIsRequestingAnalysis(true)
      setAnalysisError(null)
      
      const result = await requestFreeAnalysis(view.id, userId)
      
      if (!result.success) {
        setAnalysisError(result.error || 'Failed to request analysis')
        return
      }
      
      // Call callback if provided, otherwise use router.refresh() for efficient re-render
      if (onAnalysisRequested) {
        onAnalysisRequested()
      } else {
        // Refresh server components to show analysis results (revalidatePath handles cache invalidation)
        router.refresh()
      }
    } catch {
      setAnalysisError('An unexpected error occurred')
    } finally {
      setIsRequestingAnalysis(false)
    }
  }

  const getYouTubeUrl = () => `https://www.youtube.com/watch?v=${video.youtubeId}`
  const getEmbedUrl = () => `https://www.youtube.com/embed/${video.youtubeId}?enablejsapi=1`

  const seekToTimestamp = (timestamp: number) => {
    if (iframeRef.current) {
      // Use postMessage to control YouTube player
      iframeRef.current.contentWindow?.postMessage(
        JSON.stringify({
          event: 'command',
          func: 'seekTo',
          args: [timestamp, true]
        }),
        'https://www.youtube.com'
      )
    }
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div>
          <CardTitle className="text-lg line-clamp-2 mb-2">
            <a 
              href={getYouTubeUrl()} 
              target="_blank" 
              rel="noopener noreferrer"
              className="hover:underline"
            >
              {video.title}
            </a>
          </CardTitle>
          
          <CardDescription className="flex items-center gap-1 text-sm mb-4">
            <ClockIcon className="w-3 h-3" />
            {formatDuration(video.duration)}
          </CardDescription>

          <iframe
            ref={iframeRef}
            width="100%"
            height="315"
            src={getEmbedUrl()}
            title={video.title}
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            className="rounded-lg"
          />
        </div>
      </CardHeader>

      {analysis && (
        <CardContent className="pt-0">
          <div 
            className="cursor-pointer" 
            onClick={handleToggleExpansion}
          >
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted/70 transition-colors">
              <div className="flex-1">
                <h3 className="font-medium mb-1">TL;DR</h3>
                <p className="text-sm text-muted-foreground">
                  {analysis.tldr}
                </p>
              </div>
              {isExpanded ? (
                <ChevronUpIcon className="w-4 h-4 ml-2 flex-shrink-0" />
              ) : (
                <ChevronDownIcon className="w-4 h-4 ml-2 flex-shrink-0" />
              )}
            </div>
          </div>

          {isExpanded && (
            <div className="mt-4 space-y-4">
              <Separator />
              
              <div>
                <h4 className="font-medium mb-2">Summary</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {analysis.summary}
                </p>
              </div>

              {analysis.timestampSeconds.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Key Moments</h4>
                  <div className="space-y-2">
                    {analysis.timestampSeconds.map((timestamp, index) => (
                      <div key={index} className="flex gap-3 text-sm">
                        <button
                          onClick={() => seekToTimestamp(timestamp)}
                          className="text-primary hover:underline font-mono flex-shrink-0 text-left"
                        >
                          {formatTimestamp(timestamp)}
                        </button>
                        <span className="text-muted-foreground">
                          {analysis.timestampDescriptions[index]}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      )}

      {!analysis && (
        <CardContent className="pt-0">
          {isRequestingAnalysis ? (
            <AnalysisLoading 
              chipCost={video.chipCost}
            />
          ) : (
            <div className="p-3 bg-muted/50 rounded-lg hover:bg-muted/70 transition-colors">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium mb-1">Analysis</p>
                  <p className="text-sm text-muted-foreground">
                    This video hasn&apos;t been analyzed yet
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="secondary">
                    {video.chipCost} chip{video.chipCost !== 1 ? 's' : ''}
                  </Badge>
                  <Button 
                    onClick={handleRequestAnalysis}
                    disabled={isRequestingAnalysis}
                    size="sm"
                  >
                    Request Analysis
                  </Button>
                </div>
              </div>
              {analysisError && (
                <p className="text-sm text-destructive mt-2">
                  {analysisError}
                </p>
              )}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}