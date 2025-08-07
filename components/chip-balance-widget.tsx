'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CoinsIcon, PlusIcon, TrendingUpIcon } from 'lucide-react'
import type { User, Transaction } from '@/lib/generated/prisma'

interface ChipBalanceWidgetProps {
  user: User
  recentTransactions: Transaction[]
  onBuyChips: () => void
}

export function ChipBalanceWidget({ user, recentTransactions, onBuyChips }: ChipBalanceWidgetProps) {
  const [isLoading, setIsLoading] = useState(false)

  const handleBuyChips = async () => {
    setIsLoading(true)
    try {
      onBuyChips()
    } finally {
      setIsLoading(false)
    }
  }

  const formatChipAmount = (amount: number) => {
    return amount >= 0 ? `+${amount}` : amount.toString()
  }

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'PURCHASE':
        return <TrendingUpIcon className="w-3 h-3 text-green-500" />
      case 'DEDUCTION':
        return <CoinsIcon className="w-3 h-3 text-blue-500" />
      case 'REFUND':
        return <TrendingUpIcon className="w-3 h-3 text-amber-500" />
      case 'ADMIN_CREDIT':
        return <TrendingUpIcon className="w-3 h-3 text-green-500" />
      case 'ADMIN_DEBIT':
        return <TrendingUpIcon className="w-3 h-3 text-red-500" />
      default:
        return <CoinsIcon className="w-3 h-3 text-muted-foreground" />
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-lg">
          <div className="flex items-center gap-2">
            <CoinsIcon className="w-5 h-5 text-amber-500" />
            Chip Balance
          </div>
          <Badge variant="secondary" className="text-lg font-mono px-3 py-1">
            {user.chipBalance}
          </Badge>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <Button 
          onClick={handleBuyChips}
          disabled={isLoading}
          className="w-full"
          size="sm"
        >
          <PlusIcon className="w-4 h-4 mr-2" />
          {isLoading ? 'Loading...' : 'Buy More Chips'}
        </Button>

        {recentTransactions.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-3">Recent Activity</h4>
            <div className="space-y-2">
              {recentTransactions.slice(0, 5).map((transaction) => (
                <div key={transaction.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    {getTransactionIcon(transaction.type)}
                    <span className="text-muted-foreground line-clamp-1">
                      {transaction.description}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span 
                      className={`font-mono ${
                        transaction.chipAmount > 0 ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {formatChipAmount(transaction.chipAmount)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {user.chipBalance === 0 && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm text-amber-800">
              <span className="font-medium">No chips remaining!</span>
              <br />
              Buy chips to analyze more videos.
            </p>
          </div>
        )}
        
        {user.chipBalance > 0 && user.chipBalance < 5 && (
          <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
            <p className="text-sm text-orange-800">
              <span className="font-medium">Running low on chips!</span>
              <br />
              Consider buying more for uninterrupted analysis.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}