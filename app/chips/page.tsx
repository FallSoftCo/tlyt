import { cookies } from 'next/headers'
import { withAuth } from '@workos-inc/authkit-nextjs'
import { initializeUser, getActiveChipPackages } from '../actions'
import { ChipPackages } from '@/components/chip-packages'
import { AuthHeader } from '@/components/auth-header'
import { Button } from '@/components/ui/button'
import { ArrowLeftIcon } from 'lucide-react'
import Link from 'next/link'

export default async function ChipsPage() {
  const cookieStore = await cookies()
  const userId = cookieStore.get('userId')?.value

  // With middleware auth enabled, user is guaranteed to be authenticated
  await withAuth({ ensureSignedIn: true })

  // Initialize/sync user data
  const initResult = await initializeUser(userId)
  if (!initResult.success || !initResult.user) {
    throw new Error(`User initialization failed: ${initResult.error}`)
  }

  const { user } = initResult

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

        <AuthHeader />

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
              workosId={user.workosId || undefined}
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