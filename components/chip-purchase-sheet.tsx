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
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CoinsIcon, ShoppingCart, SparklesIcon, LogOut, Cpu, Plus, Minus } from 'lucide-react'
import type { ChipPackage } from '@/lib/generated/prisma'
import { handleSignOutAction } from '@/app/actions'

interface ChipPurchaseSheetProps {
  packages: ChipPackage[]
  chipBalance?: number
  trigger: React.ReactNode
}

export function ChipPurchaseSheet({ packages, chipBalance, trigger }: ChipPurchaseSheetProps) {
  const { user } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [selectedPackageId, setSelectedPackageId] = useState<string>('')
  const [quantity, setQuantity] = useState<number>(1)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

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
  
  // Calculate total price and chips for selected package + quantity
  const totalPrice = selectedPackage ? (selectedPackage.priceUsd * quantity) / 100 : 0
  const totalChips = selectedPackage ? selectedPackage.chipAmount * quantity : 0

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
            quantity: quantity
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
          <SheetTitle>Account & Chips</SheetTitle>
        </SheetHeader>
        
        <div className="flex-1 overflow-y-auto">
          {user ? (
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
                    1 chip per 30 minutes of video duration. Choose a package and quantity.
                  </p>
                </div>

                {/* Package Selection Cards */}
                <div className="space-y-3">
                  <h4 className="font-medium text-sm">Choose a Package:</h4>
                  <div className="grid gap-3">
                    {packages
                      .sort((a, b) => a.sortOrder - b.sortOrder)
                      .map((pkg) => (
                        <Card
                          key={pkg.id}
                          className={`relative cursor-pointer transition-all ${
                            selectedPackageId === pkg.id
                              ? 'border-primary bg-primary/5'
                              : 'hover:border-primary/50'
                          } ${bestValue?.id === pkg.id ? 'border-primary' : ''}`}
                          onClick={() => setSelectedPackageId(pkg.id)}
                        >
                          {bestValue?.id === pkg.id && (
                            <div className="absolute -top-2 left-1/2 transform -translate-x-1/2">
                              <Badge className="bg-primary text-primary-foreground">
                                <SparklesIcon className="w-3 h-3 mr-1" />
                                Best Value
                              </Badge>
                            </div>
                          )}
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <CoinsIcon className="w-4 h-4 text-amber-500" />
                                <div>
                                  <p className="font-semibold">{pkg.name}</p>
                                  <p className="text-sm text-muted-foreground">{pkg.chipAmount} chips</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="font-bold">{formatPrice(pkg.priceUsd)}</p>
                                <p className="text-xs text-muted-foreground">
                                  {calculateValuePerChip(pkg.priceUsd, pkg.chipAmount)}
                                </p>
                              </div>
                            </div>
                            {pkg.description && (
                              <p className="text-sm text-muted-foreground mt-2">{pkg.description}</p>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                  </div>
                </div>

                {/* Quantity Selector and Focused Display */}
                {selectedPackage && (
                  <Card className="overflow-hidden">
                    <CardContent className="p-4">
                      <div className="space-y-4">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <h3 className="font-medium text-lg">{selectedPackage.name}</h3>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {selectedPackage.description || `${calculateValuePerChip(selectedPackage.priceUsd, selectedPackage.chipAmount)} - ${selectedPackage.chipAmount} chips per package`}
                          </p>
                        </div>
                        
                        {/* Quantity Selector */}
                        <div className="space-y-3">
                          <label className="text-sm font-medium">Quantity:</label>
                          <div className="flex items-center gap-3">
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-8 w-8"
                              onClick={() => setQuantity(Math.max(1, quantity - 1))}
                              disabled={quantity <= 1}
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                            <Input
                              type="number"
                              min="1"
                              value={quantity}
                              onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                              className="w-20 text-center"
                            />
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-8 w-8"
                              onClick={() => setQuantity(quantity + 1)}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        
                        {/* Summary */}
                        <div className="p-4 bg-secondary/50 rounded-lg">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">{totalChips} Chips</p>
                              <p className="text-sm text-muted-foreground">Process {Math.floor(totalChips / 2)} hours of video</p>
                            </div>
                            <div className="text-right">
                              <p className="text-2xl font-bold">${totalPrice.toFixed(2)}</p>
                              <p className="text-xs text-muted-foreground">{calculateValuePerChip(selectedPackage.priceUsd, selectedPackage.chipAmount)}</p>
                            </div>
                          </div>
                        </div>
                        
                        <div className="pt-2 border-t">
                          <div className="flex justify-between text-sm">
                            <span>Total:</span>
                            <span className="font-bold">${totalPrice.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <div className="mt-4">
                  {error && (
                    <p className="text-xs text-red-500 text-center mb-2">
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
                      selectedPackage ? `Checkout (${quantity} ${quantity === 1 ? 'Package' : 'Packages'})` : 'Select a Package'
                    }
                  </Button>
                  
                  <div className="text-xs text-center text-muted-foreground mt-2">
                    Instant delivery • Secure payment via Stripe
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">Please sign in to access your account.</p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

// Export for backward compatibility  
export const AccountSheet = ChipPurchaseSheet