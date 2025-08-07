'use client'

import { useState } from 'react'
import { useAuth } from '@workos-inc/authkit-nextjs/components'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { LogOutIcon, UserIcon } from 'lucide-react'
import { handleSignOutAction } from '@/app/actions'

export function AuthHeader() {
  const { user: workosUser } = useAuth()
  const [isLoading, setIsLoading] = useState(false)

  const handleSignOut = async () => {
    try {
      setIsLoading(true)
      await handleSignOutAction()
    } catch (error) {
      console.error('Error signing out:', error)
      setIsLoading(false)
    }
  }

  // With full middleware auth, user is guaranteed to be authenticated
  if (!workosUser) {
    return <div>Loading...</div>
  }

  return (
    <Card className="mb-6">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserIcon className="w-4 h-4 text-muted-foreground" />
            <div>
              <p className="font-medium text-sm">
                {workosUser.firstName && workosUser.lastName 
                  ? `${workosUser.firstName} ${workosUser.lastName}`
                  : workosUser.firstName || workosUser.email || 'User'}
              </p>
              {workosUser.email && (
                <p className="text-xs text-muted-foreground">{workosUser.email}</p>
              )}
            </div>
          </div>

          <Button
            onClick={handleSignOut}
            disabled={isLoading}
            variant="outline"
            size="sm"
          >
            <LogOutIcon className="w-4 h-4 mr-2" />
            {isLoading ? 'Signing out...' : 'Sign Out'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}