'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@workos-inc/authkit-nextjs/components'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CoinsIcon, ShoppingCart, SparklesIcon, UserPlus, LogIn, LogOut, Cpu } from 'lucide-react'
import type { ChipPackage } from '@/lib/generated/prisma'
import { getSignInUrlAction, getSignUpUrlAction, handleSignOutAction } from '@/app/actions'

interface AccountSheetProps {
  packages: ChipPackage[]
  chipBalance?: number
  trigger: React.ReactNode
}

export function AccountSheet({ packages, chipBalance, trigger }: AccountSheetProps) {
  const { user } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [selectedPackageId, setSelectedPackageId] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [signInUrl, setSignInUrl] = useState<string>('')
  const [signUpUrl, setSignUpUrl] = useState<string>('')

  const selectedPackage = packages.find(pkg => pkg.id === selectedPackageId)

  useEffect(() => {
    if (!user) {
      getSignInUrlAction().then(setSignInUrl)
      getSignUpUrlAction().then(setSignUpUrl)
    }
  }, [user])
  
  const formatPrice = (priceInCents: number) => {
    return `$${(priceInCents / 100).toFixed(2)}`
  }

  const calculateValuePerChip = (priceInCents: number, chipAmount: number) => {
    const pricePerChip = priceInCents / chipAmount / 100
    return `$${pricePerChip.toFixed(3)}/chip`
  }

  const getBestValuePackage = () => {
    if (packages.length === 0) return null
    return packages.reduce((best, current) => {
      const bestValue = best.priceUsd / best.chipAmount
      const currentValue = current.priceUsd / current.chipAmount
      return currentValue < bestValue ? current : best
    })
  }

  const bestValue = getBestValuePackage()

  const handleCheckout = async () => {
    if (!selectedPackage) return

    setIsLoading(true)
    setError('')

    try {
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          items: [{
            priceId: selectedPackage.stripePriceId,
            quantity: 1
          }]
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create checkout session')
      }

      const { url } = await response.json()
      if (url) {
        window.location.href = url
      }
    } catch (err) {
      console.error('Error creating checkout session:', err)
      setError(err instanceof Error ? err.message : 'Failed to start checkout process')
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
      setError('Failed to sign out')
      setIsLoading(false)
    }
  }

  if (packages.length === 0) {
    return null
  }

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        {trigger}
      </SheetTrigger>
      <SheetContent className="w-full max-w-[400px] sm:max-w-md flex flex-col h-full p-6">
        <SheetHeader className="flex-shrink-0 pb-4">
          <SheetTitle>
            {user ? 'Account & Chips' : 'Sign In'}
          </SheetTitle>
        </SheetHeader>
        
        <div className="flex-1 overflow-y-auto">
          {!user ? (
            // Not logged in view  
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Sign in to purchase chips and track your history.
              </p>
              {signUpUrl && signInUrl && (
                <div className="space-y-2">
                  <Button 
                    className="w-full" 
                    onClick={() => window.location.href = signUpUrl}
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    Sign Up
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full" 
                    onClick={() => window.location.href = signInUrl}
                  >
                    <LogIn className="h-4 w-4 mr-2" />
                    Sign In
                  </Button>
                </div>
              )}
            </div>
          ) : (
            // Logged in view
            <>
              <div className="border-b pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{user.firstName || user.email}</p>
                    <p className="text-sm text-muted-foreground">
                      <Cpu className="h-3 w-3 inline mr-1" />
                      {chipBalance ?? '...'} chips remaining
                    </p>
                  </div>
                  <Button 
                    onClick={handleSignOut}
                    disabled={isLoading}
                    variant="ghost" 
                    size="sm"
                  >
                    <LogOut className="h-4 w-4 mr-1" />
                    Sign Out
                  </Button>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="p-3 bg-muted rounded-lg">
                  <h3 className="font-medium flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4" />
                    Buy Processing Chips
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    1 chip per 30 minutes of video duration. Choose your package below.
                  </p>
                </div>
                
                <div className="space-y-3">
                  <Select value={selectedPackageId} onValueChange={setSelectedPackageId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a chip package" />
                    </SelectTrigger>
                    <SelectContent>
                      {packages
                        .sort((a, b) => a.sortOrder - b.sortOrder)
                        .map((pkg) => (
                          <SelectItem key={pkg.id} value={pkg.id}>
                            <div className="flex items-center justify-between w-full">
                              <span>{pkg.name} - {pkg.chipAmount} chips</span>
                              <span className="ml-2">{formatPrice(pkg.priceUsd)}</span>
                            </div>
                          </SelectItem>
                        ))
                      }
                    </SelectContent>
                  </Select>

                {selectedPackage && (
                  <Card className={`${bestValue?.id === selectedPackage.id ? 'border-primary' : ''}`}>
                    {bestValue?.id === selectedPackage.id && (
                      <div className="absolute -top-2 left-1/2 transform -translate-x-1/2">
                        <Badge className="bg-primary text-primary-foreground">
                          <SparklesIcon className="w-3 h-3 mr-1" />
                          Best Value
                        </Badge>
                      </div>
                    )}
                    
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <CoinsIcon className="w-5 h-5 text-amber-500" />
                            <div>
                              <h3 className="font-semibold">{selectedPackage.name}</h3>
                              <p className="text-sm text-muted-foreground">
                                {selectedPackage.chipAmount} chips
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold">
                              {formatPrice(selectedPackage.priceUsd)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {calculateValuePerChip(selectedPackage.priceUsd, selectedPackage.chipAmount)}
                            </div>
                          </div>
                        </div>
                        
                        {selectedPackage.description && (
                          <p className="text-sm text-muted-foreground">
                            {selectedPackage.description}
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {error && (
                  <p className="text-sm text-red-500 text-center">
                    {error}
                  </p>
                )}

                <Button 
                  onClick={handleCheckout}
                  disabled={!selectedPackage || isLoading}
                  className="w-full"
                  size="lg"
                >
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  {isLoading ? 'Processing...' : 
                    selectedPackage ? `Checkout - ${formatPrice(selectedPackage.priceUsd)}` : 'Select a Package'
                  }
                </Button>

                  <div className="text-xs text-center text-muted-foreground">
                    Instant delivery • Secure payment via Stripe
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

// Keep old export name for compatibility
export const ChipPurchaseSheet = AccountSheet