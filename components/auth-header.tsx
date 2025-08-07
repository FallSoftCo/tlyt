'use client'

import { useState } from 'react'
import { useAuth } from '@workos-inc/authkit-nextjs/components'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { LogInIcon, LogOutIcon, UserIcon, CoinsIcon } from 'lucide-react'
import { getSignInUrlAction, getSignUpUrlAction, handleSignOutAction } from '@/app/actions'
import type { User } from '@/lib/generated/prisma'

interface AuthHeaderProps {
  user?: User | null
  chipBalance?: number
}

export function AuthHeader({ user, chipBalance }: AuthHeaderProps) {
  const { user: workosUser } = useAuth()
  const [isLoading, setIsLoading] = useState(false)

  const handleSignIn = async () => {
    try {
      setIsLoading(true)
      const signInUrl = await getSignInUrlAction()
      window.location.href = signInUrl
    } catch (error) {
      console.error('Error getting sign-in URL:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSignUp = async () => {
    try {
      setIsLoading(true)
      const signUpUrl = await getSignUpUrlAction()
      window.location.href = signUpUrl
    } catch (error) {
      console.error('Error getting sign-up URL:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSignOut = async () => {
    try {
      setIsLoading(true)
      await handleSignOutAction()
    } catch (error) {
      console.error('Error signing out:', error)
      setIsLoading(false)
    }
  }

  if (workosUser) {
    return (
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
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
              
              {user && (
                <div className="flex items-center gap-2">
                  <CoinsIcon className="w-4 h-4 text-amber-500" />
                  <Badge variant="secondary" className="font-mono">
                    {chipBalance || user.chipBalance || 0} chips
                  </Badge>
                </div>
              )}
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

  return (
    <Card className="mb-6">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-sm mb-1">
              Sign in for unlimited video analysis
            </p>
            <p className="text-xs text-muted-foreground">
              Buy chips to analyze as many videos as you want
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={handleSignUp}
              disabled={isLoading}
              variant="default"
              size="sm"
            >
              <UserIcon className="w-4 h-4 mr-2" />
              Sign Up
            </Button>
            <Button
              onClick={handleSignIn}
              disabled={isLoading}
              variant="outline"
              size="sm"
            >
              <LogInIcon className="w-4 h-4 mr-2" />
              Sign In
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}