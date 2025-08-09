import { cookies } from 'next/headers'
import { withAuth } from '@workos-inc/authkit-nextjs'
import { redirect } from 'next/navigation'
import { getUserData, initializeUser, getActiveChipPackages } from './actions'
import { PasteButton } from '@/components/paste-button'
import { ViewList } from '@/components/view-list'
import { CookieHandler } from '@/components/cookie-handler'
import { Header } from '@/components/header'
import { Footer } from '@/components/footer'

export default async function Home() {
  const cookieStore = await cookies()
  const userId = cookieStore.get('userId')?.value

  // Check if user is authenticated - if not, redirect to trial
  const { user: workosUser } = await withAuth()
  
  if (!workosUser) {
    // Unauthenticated users should use the trial experience
    redirect('/trial')
  }

  // Initialize/sync user data (guaranteed authenticated due to middleware)
  const initResult = await initializeUser(userId)
  if (!initResult.success || !initResult.user) {
    throw new Error(`User initialization failed: ${initResult.error}`)
  }

  const { user } = initResult
  const finalUserId = user.id

  console.log('🎉 Authenticated user page load:', { 
    userId: finalUserId,
    workosId: user.workosId,
    email: user.email 
  })

  // Get user data
  const userData = await getUserData(finalUserId)
  if (!userData.success) {
    throw new Error(`Failed to load user data: ${userData.error}`)
  }

  const { views, videos = [], analyses = [] } = userData


  // Get available chip packages
  const packagesResult = await getActiveChipPackages()
  const packages = packagesResult.success && packagesResult.packages ? packagesResult.packages : []

  return (
    <div className="min-h-screen bg-background">
      <CookieHandler userId={finalUserId} />
      
      {/* Fixed Header */}
      <Header packages={packages} user={user} chipBalance={user.chipBalance} />

      {/* Main Content */}
      <div className="pt-[3.5rem] sm:pt-[5rem] pb-20 px-4 max-w-[90ch] mx-auto">
        {views && views.length > 0 ? (
          <div className="space-y-4 py-4">
            <ViewList
              views={views}
              videos={videos}
              analyses={analyses}
              userId={finalUserId}
              isAuthenticated={true}
              chipBalance={user.chipBalance}
            />
          </div>
        ) : (
          <div className="text-center py-24">
            <h1 className="text-5xl sm:text-6xl font-bold leading-tight mb-8">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-600 to-red-500">
                TLYT
              </span>{' '}
              watches YouTube<br />
              so you don&apos;t have to
            </h1>
            
            <PasteButton userId={finalUserId} />
          </div>
        )}
      </div>

      {/* Fixed Footer */}
      <Footer userId={finalUserId} />
    </div>
  )
}
