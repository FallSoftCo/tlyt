'use client'

import { useState } from 'react'
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
import { CoinsIcon, ShoppingCart, SparklesIcon, UserPlus, LogIn } from 'lucide-react'
import type { ChipPackage, User } from '@/lib/generated/prisma'
import { getSignInUrlAction, getSignUpUrlAction } from '@/app/actions'

interface ChipPurchaseSheetProps {
  packages: ChipPackage[]
  user?: User | null
  trigger: React.ReactNode
}

export function ChipPurchaseSheet({ packages, user, trigger }: ChipPurchaseSheetProps) {
  const { user: workosUser } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [selectedPackageId, setSelectedPackageId] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [checkoutError, setCheckoutError] = useState('')

  const selectedPackage = packages.find(pkg => pkg.id === selectedPackageId)
  
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

    if (!workosUser) {
      // Redirect to sign up for unauthenticated users
      try {
        const signUpUrl = await getSignUpUrlAction()
        window.location.href = signUpUrl
        return
      } catch {
        setCheckoutError('Failed to redirect to sign up')
        return
      }
    }

    setIsLoading(true)
    setCheckoutError('')

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
          }],
          userId: user?.id,
          workosId: workosUser?.id
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
    } catch (error) {
      console.error('Error creating checkout session:', error)
      setCheckoutError(error instanceof Error ? error.message : 'Failed to start checkout process')
    } finally {
      setIsLoading(false)
    }
  }

  const handleAuthAction = async (action: 'signin' | 'signup') => {
    try {
      const url = action === 'signin' 
        ? await getSignInUrlAction()
        : await getSignUpUrlAction()
      window.location.href = url
    } catch {
      setCheckoutError(`Failed to redirect to ${action}`)
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
      <SheetContent className="w-full max-w-[400px] sm:max-w-md flex flex-col h-full">
        <SheetHeader className="flex-shrink-0">
          <SheetTitle>
            {workosUser ? 'Buy Processing Chips' : 'Chip Pricing'}
          </SheetTitle>
        </SheetHeader>
        
        <div className="flex-1 overflow-y-auto py-4">
          {!workosUser ? (
            // Unauthenticated user view - show pricing transparency
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">
                  See our chip pricing. Sign in to purchase and get unlimited video analysis.
                </p>
              </div>

              <div className="space-y-3">
                {packages
                  .sort((a, b) => a.sortOrder - b.sortOrder)
                  .map((pkg) => (
                    <Card key={pkg.id} className={`relative ${
                      bestValue?.id === pkg.id ? 'border-primary' : ''
                    }`}>
                      {bestValue?.id === pkg.id && (
                        <div className="absolute -top-2 left-1/2 transform -translate-x-1/2">
                          <Badge className="bg-primary text-primary-foreground">
                            <SparklesIcon className="w-3 h-3 mr-1" />
                            Best Value
                          </Badge>
                        </div>
                      )}
                      
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <CoinsIcon className="w-4 h-4 text-amber-500" />
                            <span className="font-semibold">{pkg.name}</span>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold">{formatPrice(pkg.priceUsd)}</div>
                            <div className="text-xs text-muted-foreground">
                              {calculateValuePerChip(pkg.priceUsd, pkg.chipAmount)}
                            </div>
                          </div>
                        </div>
                        {pkg.description && (
                          <p className="text-sm text-muted-foreground">{pkg.description}</p>
                        )}
                      </CardContent>
                    </Card>
                  ))
                }
              </div>

              <div className="space-y-2 pt-4 border-t">
                <Button 
                  onClick={() => handleAuthAction('signup')} 
                  className="w-full"
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Sign Up to Purchase
                </Button>
                <Button 
                  onClick={() => handleAuthAction('signin')} 
                  variant="outline" 
                  className="w-full"
                >
                  <LogIn className="h-4 w-4 mr-2" />
                  Sign In
                </Button>
              </div>
            </div>
          ) : (
            // Authenticated user view - full purchase flow
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">
                  1 chip per video processed. Choose your package below.
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
              </div>

              {checkoutError && (
                <p className="text-sm text-red-500 text-center">
                  {checkoutError}
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
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}