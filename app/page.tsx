import { cookies } from 'next/headers'
import { getUserData, initializeUser } from './actions'
import { PasteButton } from '@/components/paste-button'
import { ViewList } from '@/components/view-list'
import { CookieHandler } from '@/components/cookie-handler'

export default async function Home() {
  const cookieStore = await cookies()
  let userId = cookieStore.get('userId')?.value

  // If no userId, create a new unauthenticated user (cookies will be set client-side)
  if (!userId) {
    const result = await initializeUser()
    if (!result.success || !result.user) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-destructive">Error</h1>
            <p className="text-muted-foreground mt-2">{result.error}</p>
          </div>
        </div>
      )
    }
    userId = result.user.id
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
      <CookieHandler userId={userId} />
      <div className="container mx-auto px-4 py-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">TLYT</h1>
          <p className="text-muted-foreground mt-2">
            TLYT watches YouTube so you don&apos;t have to
          </p>
        </header>

        <main>
          {views && views.length > 0 ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Your Videos</h2>
                <PasteButton 
                  userId={userId}
                />
              </div>
              <ViewList
                views={views}
                videos={videos}
                analyses={analyses}
                userId={userId}
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
              />
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
