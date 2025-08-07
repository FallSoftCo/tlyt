import { cookies } from 'next/headers'
import { initializeUser, getActiveChipPackages } from '../actions'
import { ChipPackages } from '@/components/chip-packages'
import { AuthHeader } from '@/components/auth-header'
import { Button } from '@/components/ui/button'
import { ArrowLeftIcon } from 'lucide-react'
import Link from 'next/link'

export default async function ChipsPage() {
  const cookieStore = await cookies()
  const userId = cookieStore.get('userId')?.value

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

  // Redirect unauthenticated users
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <header className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight">TLYT</h1>
            <p className="text-muted-foreground mt-2">
              TLYT watches YouTube so you don&apos;t have to
            </p>
          </header>

          <AuthHeader user={user} isAuthenticated={isAuthenticated} />

          <div className="text-center py-12">
            <h2 className="text-2xl font-bold mb-4">Sign In Required</h2>
            <p className="text-muted-foreground mb-6">
              You need to sign in to purchase chips
            </p>
            <Link href="/">
              <Button variant="outline">
                <ArrowLeftIcon className="w-4 h-4 mr-2" />
                Back to Home
              </Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Get available chip packages
  const packagesResult = await getActiveChipPackages()
  const packages = packagesResult.success && packagesResult.packages ? packagesResult.packages : []

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <header className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Link href="/">
              <Button variant="ghost" size="sm">
                <ArrowLeftIcon className="w-4 h-4 mr-2" />
                Back
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Buy Chips</h1>
              <p className="text-muted-foreground mt-2">
                Get chips to analyze unlimited YouTube videos
              </p>
            </div>
          </div>
        </header>

        <AuthHeader user={user} isAuthenticated={isAuthenticated} />

        <main>
          <div className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">Choose Your Package</h2>
            <p className="text-muted-foreground mb-6">
              Each chip allows you to analyze 30 minutes of video content. 
              Longer videos use more chips automatically.
            </p>
          </div>

          {packages.length > 0 ? (
            <ChipPackages
              packages={packages}
              userId={user.id}
              onPackageSelected={() => {
                // This will redirect to Stripe, so no action needed
              }}
            />
          ) : (
            <div className="text-center py-12">
              <h3 className="text-xl font-semibold mb-4">No Packages Available</h3>
              <p className="text-muted-foreground mb-6">
                Chip packages are not configured yet. Please check back later.
              </p>
              <Link href="/">
                <Button variant="outline">
                  <ArrowLeftIcon className="w-4 h-4 mr-2" />
                  Back to Home
                </Button>
              </Link>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}