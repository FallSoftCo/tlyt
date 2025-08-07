'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CoinsIcon, CheckIcon, SparklesIcon } from 'lucide-react'
import type { ChipPackage } from '@/lib/generated/prisma'

interface ChipPackagesProps {
  packages: ChipPackage[]
  userId: string
  workosId?: string
  onPackageSelected?: () => void
}

export function ChipPackages({ packages, userId, workosId, onPackageSelected }: ChipPackagesProps) {
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const formatPrice = (priceInCents: number) => {
    return `$${(priceInCents / 100).toFixed(2)}`
  }

  const calculateValuePerChip = (priceInCents: number, chipAmount: number) => {
    const pricePerChip = priceInCents / chipAmount / 100
    return `$${pricePerChip.toFixed(3)}/chip`
  }

  const handlePurchase = async (packageId: string, stripePriceId: string) => {
    setIsLoading(true)
    setSelectedPackage(packageId)

    try {
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          items: [{
            priceId: stripePriceId,
            quantity: 1
          }],
          userId: userId,
          workosId: workosId
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
      alert(error instanceof Error ? error.message : 'Failed to start checkout process')
    } finally {
      setIsLoading(false)
      setSelectedPackage(null)
      onPackageSelected?.()
    }
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

  if (packages.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-muted-foreground">No chip packages available at the moment.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {packages
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((pkg) => (
          <Card 
            key={pkg.id} 
            className={`relative ${
              bestValue?.id === pkg.id ? 'border-primary shadow-md' : ''
            }`}
          >
            {bestValue?.id === pkg.id && (
              <div className="absolute -top-2 left-1/2 transform -translate-x-1/2">
                <Badge className="bg-primary text-primary-foreground">
                  <SparklesIcon className="w-3 h-3 mr-1" />
                  Best Value
                </Badge>
              </div>
            )}

            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between">
                <span>{pkg.name}</span>
                <div className="flex items-center gap-1">
                  <CoinsIcon className="w-4 h-4 text-amber-500" />
                  <span className="font-mono">{pkg.chipAmount}</span>
                </div>
              </CardTitle>
              {pkg.description && (
                <p className="text-sm text-muted-foreground">{pkg.description}</p>
              )}
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="text-center">
                <div className="text-2xl font-bold">
                  {formatPrice(pkg.priceUsd)}
                </div>
                <div className="text-xs text-muted-foreground">
                  {calculateValuePerChip(pkg.priceUsd, pkg.chipAmount)}
                </div>
              </div>

              <Button
                onClick={() => handlePurchase(pkg.id, pkg.stripePriceId)}
                disabled={isLoading}
                className="w-full"
                variant={bestValue?.id === pkg.id ? 'default' : 'outline'}
              >
                {isLoading && selectedPackage === pkg.id ? (
                  'Processing...'
                ) : (
                  <>
                    <CheckIcon className="w-4 h-4 mr-2" />
                    Buy Now
                  </>
                )}
              </Button>

              <div className="text-xs text-center text-muted-foreground">
                Instant delivery • Secure payment
              </div>
            </CardContent>
          </Card>
        ))}
    </div>
  )
}