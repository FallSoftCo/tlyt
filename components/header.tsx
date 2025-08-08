import { ChipPurchaseSheet } from '@/components/chip-purchase-sheet'
import { Button } from '@/components/ui/button'
import { User, Cpu } from 'lucide-react'
import type { ChipPackage, User as UserType } from '@/lib/generated/prisma'

interface HeaderProps {
  packages: ChipPackage[]
  user?: UserType | null
  chipBalance?: number
}

export function Header({ packages, user, chipBalance }: HeaderProps) {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-[3.5rem] sm:h-[5rem] px-4 sm:px-6 flex items-center justify-between rounded-b-3xl bg-background/95 backdrop-blur-sm border-b">
      {/* Logo */}
      <div className="flex items-center">
        <h1 className="text-xl sm:text-2xl font-bold">
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-600 to-red-500">
            TLYT
          </span>
        </h1>
      </div>
      
      {/* Account Button - shows chips for authenticated users, or sign in prompt for unauthenticated */}
      <div className="flex items-center">
        <ChipPurchaseSheet
          packages={packages}
          chipBalance={chipBalance}
          trigger={
            <Button variant="secondary" className="min-w-[120px] sm:min-w-[150px]">
              <div className="flex items-center">
                <User className="h-5 w-5 mr-2" />
                {user ? (
                  <div className="flex items-center">
                    <Cpu className="h-4 w-4 mr-1" />
                    <span className="font-semibold">
                      {chipBalance ?? '...'}
                    </span>
                  </div>
                ) : (
                  <span className="font-semibold">Account</span>
                )}
              </div>
            </Button>
          }
        />
      </div>
    </header>
  )
}