import { cookies } from 'next/headers'
import { initializeUser, getUserData } from './actions'
import { PasteButton } from '@/components/paste-button'
import { ViewList } from '@/components/view-list'

export default async function Home() {
  const cookieStore = cookies()
  let userId = cookieStore.get('userId')?.value

  // Initialize or upgrade user
  if (!userId) {
    // No existing user, create new one
    const result = await initializeUser()
    if (result.success && result.user) {
      userId = result.user.id
      cookieStore.set('userId', userId, {
        maxAge: 60 * 60 * 24 * 365, // 1 year
        httpOnly: false, // Allow client access
        sameSite: 'lax'
      })
    } else {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-destructive">Error</h1>
            <p className="text-muted-foreground mt-2">{result.error}</p>
          </div>
        </div>
      )
    }
  } else {
    // Existing user - check if they need authentication upgrade
    const result = await initializeUser(userId)
    if (result.success && result.user && result.user.id !== userId) {
      // User switched to existing authenticated account, update cookie
      userId = result.user.id
      cookieStore.set('userId', userId, {
        maxAge: 60 * 60 * 24 * 365, // 1 year
        httpOnly: false,
        sameSite: 'lax'
      })
    }
    // Note: If upgrading existing user, userId stays the same
  }

  // Get user data
  const userData = await getUserData(userId)
  if (!userData.success) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-destructive">Error</h1>
          <p className="text-muted-foreground mt-2">{userData.error}</p>
        </div>
      </div>
    )
  }

  const { views, videos = [], analyses = [] } = userData

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">TLYT</h1>
          <p className="text-muted-foreground mt-2">
            YouTube Video Analysis with AI
          </p>
        </header>

        <main>
          {views && views.length > 0 ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Your Videos</h2>
                <PasteButton 
                  userId={userId}
                  onVideoSubmitted={() => {
                    // Refresh the page to show new video
                    window.location.reload()
                  }}
                />
              </div>
              <ViewList
                views={views}
                videos={videos}
                analyses={analyses}
                userId={userId}
                onAnalysisRequested={() => {
                  // Refresh the page to show new analysis
                  window.location.reload()
                }}
              />
            </div>
          ) : (
            <div className="text-center py-12">
              <h2 className="text-xl font-semibold mb-4">Welcome to TLYT</h2>
              <p className="text-muted-foreground mb-6">
                Get started by pasting a YouTube video link
              </p>
              <PasteButton 
                userId={userId}
                onVideoSubmitted={() => {
                  // Refresh the page to show new video
                  window.location.reload()
                }}
              />
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
