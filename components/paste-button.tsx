'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ClipboardIcon, CheckIcon } from 'lucide-react'
import { submitYouTubeLinkUnauthenticated } from '@/app/actions'

interface PasteButtonProps {
  userId: string
  onVideoSubmitted?: () => void
}

export function PasteButton({ userId, onVideoSubmitted }: PasteButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handlePaste = async () => {
    try {
      setIsLoading(true)
      setError(null)
      setSuccess(false)

      // Check if clipboard API is available
      if (!navigator.clipboard) {
        setError('Clipboard access not available. Please use HTTPS or localhost.')
        return
      }

      // Read from clipboard
      const clipboardText = await navigator.clipboard.readText()
      
      if (!clipboardText) {
        setError('No content found in clipboard')
        return
      }

      // Check if it looks like a YouTube URL
      const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/
      if (!youtubeRegex.test(clipboardText)) {
        setError('Please copy a valid YouTube URL to your clipboard')
        return
      }

      // Submit the YouTube link
      const result = await submitYouTubeLinkUnauthenticated(clipboardText, userId)
      
      if (!result.success) {
        setError(result.error || 'Failed to process video')
        return
      }

      setSuccess(true)
      onVideoSubmitted?.()
      
      // Reset success state after 2 seconds
      setTimeout(() => setSuccess(false), 2000)
      
    } catch (err) {
      if (err instanceof Error && err.name === 'NotAllowedError') {
        setError('Please allow clipboard access to paste YouTube links')
      } else {
        setError('Failed to read from clipboard')
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <Button
        onClick={handlePaste}
        disabled={isLoading}
        size="lg"
        className="min-w-[200px]"
      >
        {success ? (
          <>
            <CheckIcon className="w-4 h-4 mr-2" />
            Video Added!
          </>
        ) : (
          <>
            <ClipboardIcon className="w-4 h-4 mr-2" />
            {isLoading ? 'Processing...' : 'Paste YouTube Link'}
          </>
        )}
      </Button>
      
      {error && (
        <div className="text-sm text-destructive text-center max-w-md">
          {error}
        </div>
      )}
      
      {!error && !success && (
        <div className="text-sm text-muted-foreground text-center max-w-md">
          Copy a YouTube URL to your clipboard, then click the button above
        </div>
      )}
    </div>
  )
}