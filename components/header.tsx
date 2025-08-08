'use client'

import { useAuth } from '@workos-inc/authkit-nextjs/components'
import { ChipPurchaseSheet } from '@/components/chip-purchase-sheet'
import { Button } from '@/components/ui/button'
import { User, Cpu, UserPlus, LogIn } from 'lucide-react'
import { getSignInUrlAction, getSignUpUrlAction } from '@/app/actions'
import { useState, useEffect } from 'react'
import type { ChipPackage } from '@/lib/generated/prisma'

interface HeaderProps {
  packages: ChipPackage[]
  chipBalance?: number
}

export function Header({ packages, chipBalance }: HeaderProps) {
  const { user, loading } = useAuth()
  const [signInUrl, setSignInUrl] = useState<string>('')
  const [signUpUrl, setSignUpUrl] = useState<string>('')

  useEffect(() => {
    if (!user) {
      getSignInUrlAction().then(setSignInUrl)
      getSignUpUrlAction().then(setSignUpUrl)
    }
  }, [user])

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-[3.5rem] sm:h-[5rem] px-4 sm:px-6 flex items-center justify-between rounded-b-3xl">
      {/* Logo */}
      <div className="flex items-center">
        <h1 className="text-xl sm:text-2xl font-bold">TLYT</h1>
      </div>
      
      {/* Account/Chip Button */}
      <div className="flex items-center">
        {loading ? (
          <Button disabled variant="secondary" className="min-w-[120px] sm:min-w-[150px]">
            <User className="h-5 w-5 mr-2" />
            Loading...
          </Button>
        ) : user ? (
          <ChipPurchaseSheet
            packages={packages}
            canCheckout={true}
            trigger={
              <Button variant="secondary" className="min-w-[120px] sm:min-w-[150px]">
                <div className="flex items-center">
                  <User className="h-5 w-5 mr-2" />
                  <div className="flex items-center">
                    <Cpu className="h-4 w-4 mr-1" />
                    <span className="font-semibold">
                      {chipBalance ?? '...'}
                    </span>
                  </div>
                </div>
              </Button>
            }
          />
        ) : (
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => signInUrl && (window.location.href = signInUrl)}
              disabled={!signInUrl}
            >
              <LogIn className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Sign In</span>
            </Button>
            <Button 
              size="sm"
              onClick={() => signUpUrl && (window.location.href = signUpUrl)}
              disabled={!signUpUrl}
            >
              <UserPlus className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Sign Up</span>
            </Button>
          </div>
        )}
      </div>
    </header>
  )
}