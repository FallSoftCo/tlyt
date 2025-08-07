import { cookies } from 'next/headers'
import { withAuth } from '@workos-inc/authkit-nextjs'
import { redirect } from 'next/navigation'
import { getUserData, initializeUser, getRecentTransactions } from './actions'
import type { Transaction } from '@/lib/generated/prisma'
import { PasteButton } from '@/components/paste-button'
import { ViewList } from '@/components/view-list'
import { CookieHandler } from '@/components/cookie-handler'
import { AuthHeader } from '@/components/auth-header'
import { ChipBalanceWidget } from '@/components/chip-balance-widget'

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

  // Get recent transactions
  const transactionsResult = await getRecentTransactions(finalUserId, 5)
  const recentTransactions: Transaction[] = transactionsResult.success ? 
    (transactionsResult.transactions || []) : []

  return (
    <div className="min-h-screen bg-background">
      <CookieHandler userId={finalUserId} />
      <div className="container mx-auto px-4 py-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">TLYT</h1>
          <p className="text-muted-foreground mt-2">
            TLYT watches YouTube so you don&apos;t have to
          </p>
        </header>

        {/* Authentication Header - only uses useAuth() hook now */}
        <AuthHeader />

        <main>
          {/* Authenticated user content */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
            <div className="lg:col-span-1">
              <ChipBalanceWidget
                user={user}
                recentTransactions={recentTransactions}
              />
            </div>
            <div className="lg:col-span-3">
              {/* Content area for authenticated users */}
            </div>
          </div>

          {views && views.length > 0 ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Your Videos</h2>
                <PasteButton 
                  userId={finalUserId}
                />
              </div>
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
            <div className="text-center py-12">
              <h2 className="text-xl font-semibold mb-4">Welcome to TLYT</h2>
              <p className="text-muted-foreground mb-6">
                Get started by pasting a YouTube video link
              </p>
              <PasteButton 
                userId={finalUserId}
              />
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
