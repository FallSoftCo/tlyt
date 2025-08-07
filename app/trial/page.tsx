import { cookies } from 'next/headers'
import { getUserData, getTrialUserId } from '../actions'
import { PasteButton } from '@/components/paste-button'
import { ViewList } from '@/components/view-list'
import { CookieHandler } from '@/components/cookie-handler'
import { TrialHeader } from '@/components/trial-header'
import { TrialLimitWidget } from '@/components/trial-limit-widget'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default async function TrialPage() {
  const cookieStore = await cookies()
  const userId = cookieStore.get('userId')?.value

  // Get or create trial user ID
  const trialResult = await getTrialUserId(userId)
  if (!trialResult.success || !trialResult.userId) {
    throw new Error(`Failed to get trial user: ${trialResult.error}`)
  }

  const finalUserId = trialResult.userId

  console.log('🎪 Trial page load:', { 
    userId: finalUserId,
    isNewTrialUser: trialResult.isNewUser 
  })

  // Get user data
  const userData = await getUserData(finalUserId)
  if (!userData.success) {
    throw new Error(`Failed to load user data: ${userData.error}`)
  }

  const { views, videos = [], analyses = [] } = userData

  return (
    <div className="min-h-screen bg-background">
      <CookieHandler userId={finalUserId} />
      <div className="container mx-auto px-4 py-8">
        <header className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">TLYT</h1>
              <p className="text-muted-foreground mt-2">
                TLYT watches YouTube so you don&apos;t have to
              </p>
            </div>
            <div className="flex gap-2">
              <Link href="/sign-in">
                <Button variant="outline">Sign In</Button>
              </Link>
              <Link href="/sign-up">
                <Button>Sign Up</Button>
              </Link>
            </div>
          </div>
        </header>

        {/* Trial Header */}
        <TrialHeader />

        <main>
          {/* Trial content */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
            <div className="lg:col-span-1">
              <TrialLimitWidget />
            </div>
            <div className="lg:col-span-3">
              {/* Content area for trial users */}
            </div>
          </div>

          {views && views.length > 0 ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Your Videos</h2>
                <PasteButton 
                  userId={finalUserId}
                  isAuthenticated={false}
                />
              </div>
              <ViewList
                views={views}
                videos={videos}
                analyses={analyses}
                userId={finalUserId}
                isAuthenticated={false}
                chipBalance={0}
              />
            </div>
          ) : (
            <div className="text-center py-12">
              <h2 className="text-xl font-semibold mb-4">Welcome to TLYT Trial</h2>
              <p className="text-muted-foreground mb-2">
                Try our YouTube video analysis for free
              </p>
              <p className="text-sm text-muted-foreground mb-6">
                1 video every 15 minutes • Sign up for unlimited access
              </p>
              <PasteButton 
                userId={finalUserId}
                isAuthenticated={false}
              />
            </div>
          )}
        </main>
      </div>
    </div>
  )
}