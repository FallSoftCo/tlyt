import { cookies } from 'next/headers'
import { getUserData, initializeUser, getActiveChipPackages } from '../actions'
import { PasteButton } from '@/components/paste-button'
import { ViewList } from '@/components/view-list'
import { CookieHandler } from '@/components/cookie-handler'
import { Header } from '@/components/header'
import { Footer } from '@/components/footer'

export default async function TrialPage() {
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

  // Get available chip packages for pricing transparency
  const packagesResult = await getActiveChipPackages()
  const packages = packagesResult.success && packagesResult.packages ? packagesResult.packages : []

  return (
    <div className="min-h-screen bg-background">
      <CookieHandler userId={userId} />
      
      {/* Fixed Header */}
      <Header packages={packages} />

      {/* Main Content */}
      <div className="pt-[3.5rem] sm:pt-[5rem] pb-20 px-4 max-w-[90ch] mx-auto">
        {views && views.length > 0 ? (
          <div className="space-y-4">
            <ViewList
              views={views}
              videos={videos}
              analyses={analyses}
              userId={userId}
            />
          </div>
        ) : (
          <div className="text-center py-20">
            <h1 className="text-4xl font-bold mb-8">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">
                TLYT
              </span>{' '}
              watches YouTube so you don&apos;t have to
            </h1>
            
            <PasteButton userId={userId} />
          </div>
        )}
      </div>

      {/* Fixed Footer */}
      <Footer userId={userId} />
    </div>
  )
}