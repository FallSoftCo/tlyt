import { cookies } from 'next/headers'
import { getUserData, initializeUser, getRecentTransactions } from './actions'
import type { Transaction } from '@/lib/generated/prisma'
import { PasteButton } from '@/components/paste-button'
import { ViewList } from '@/components/view-list'
import { CookieHandler } from '@/components/cookie-handler'
import { AuthHeader } from '@/components/auth-header'
import { ChipBalanceWidget } from '@/components/chip-balance-widget'

export default async function Home() {
  const cookieStore = await cookies()
  let userId = cookieStore.get('userId')?.value

  // Initialize user (handles both authenticated and unauthenticated cases)
  const initResult = await initializeUser(userId)
  if (!initResult.success || !initResult.user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-destructive">Error</h1>
          <p className="text-muted-foreground mt-2">{initResult.error}</p>
        </div>
      </div>
    )
  }

  const { user, isAuthenticated } = initResult
  userId = user.id

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

  // Get recent transactions for authenticated users
  let recentTransactions: Transaction[] = []
  if (isAuthenticated && user) {
    const transactionsResult = await getRecentTransactions(userId, 5)
    if (transactionsResult.success && transactionsResult.transactions) {
      recentTransactions = transactionsResult.transactions
    }
  }

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

        {/* Authentication Header */}
        <AuthHeader user={user} isAuthenticated={isAuthenticated} />

        <main>
          {isAuthenticated && user && (
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
              <div className="lg:col-span-1">
                <ChipBalanceWidget
                  user={user}
                  recentTransactions={recentTransactions}
                  onBuyChips={() => {
                    window.location.href = '/chips'
                  }}
                />
              </div>
              <div className="lg:col-span-3">
                {/* Content area for authenticated users */}
              </div>
            </div>
          )}

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
                isAuthenticated={isAuthenticated}
                chipBalance={user?.chipBalance}
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
