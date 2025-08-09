'use client'

import { useState, useEffect } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CoinsIcon, SparklesIcon, UserPlus, LogIn, Clock, Zap, Shield } from 'lucide-react'
import type { ChipPackage } from '@/lib/generated/prisma'
import { getSignInUrlAction, getSignUpUrlAction } from '@/app/actions'

interface TrialAccountSheetProps {
  packages: ChipPackage[]
  trigger: React.ReactNode
}

export function TrialAccountSheet({ packages, trigger }: TrialAccountSheetProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [signInUrl, setSignInUrl] = useState<string>('')
  const [signUpUrl, setSignUpUrl] = useState<string>('')

  useEffect(() => {
    getSignInUrlAction().then(setSignInUrl)
    getSignUpUrlAction().then(setSignUpUrl)
  }, [])
  
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

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        {trigger}
      </SheetTrigger>
      <SheetContent className="w-full max-w-[400px] sm:max-w-md flex flex-col h-full p-6">
        <SheetHeader className="flex-shrink-0 pb-4">
          <SheetTitle>Get Started with TLYT</SheetTitle>
        </SheetHeader>
        
        <div className="flex-1 overflow-y-auto">
          <div className="space-y-6">
            {/* Benefits Section */}
            <div className="space-y-4">
              <div className="text-center p-4 bg-gradient-to-r from-red-50 to-red-100 dark:from-red-950/20 dark:to-red-900/20 rounded-lg">
                <h3 className="font-semibold text-lg mb-2">Why Sign Up?</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-red-600" />
                    <span>Unlimited video processing</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-red-600" />
                    <span>No 15-minute wait times</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-red-600" />
                    <span>Save your analysis history</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Pricing Transparency */}
            <div className="space-y-4">
              <h3 className="font-medium text-center">Processing Chip Packages</h3>
              <p className="text-sm text-muted-foreground text-center">
                1 chip processes 30 minutes of video. Sign up to purchase chips and get started!
              </p>
              
              {packages.length > 0 ? (
                <div className="space-y-3">
                  {packages
                    .sort((a, b) => a.sortOrder - b.sortOrder)
                    .map((pkg) => (
                    <Card
                      key={pkg.id}
                      className={`relative ${bestValue?.id === pkg.id ? 'border-primary' : ''}`}
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
                              <p className="text-sm text-muted-foreground">
                                {pkg.chipAmount} chips • Process {Math.floor(pkg.chipAmount / 2)} hours
                              </p>
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
              ) : (
                <div className="space-y-3">
                  <Card className="border-dashed">
                    <CardContent className="p-4 text-center">
                      <CoinsIcon className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">
                        Pricing information is loading...
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Sign up now to get access to affordable chip packages!
                      </p>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>

            {/* Call to Action */}
            <div className="space-y-4">
              <div className="text-center p-4 bg-muted rounded-lg">
                <h3 className="font-medium mb-2">Ready to get started?</h3>
                <p className="text-sm text-muted-foreground">
                  Create your account to purchase chips and start processing unlimited videos.
                </p>
              </div>

              {signUpUrl && signInUrl && (
                <div className="space-y-2">
                  <Button 
                    className="w-full" 
                    size="lg"
                    onClick={() => window.location.href = signUpUrl}
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    Sign Up & Get Started
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full" 
                    onClick={() => window.location.href = signInUrl}
                  >
                    <LogIn className="h-4 w-4 mr-2" />
                    Already have an account? Sign In
                  </Button>
                </div>
              )}
              
              <div className="text-xs text-center text-muted-foreground">
                Instant access • Secure payments • No commitments
              </div>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}