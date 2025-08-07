import { Card, CardContent } from '@/components/ui/card'
import { Clock, Zap } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export function TrialHeader() {
  return (
    <Card className="mb-6 border-blue-200 bg-blue-50/50">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-blue-600">
              <Clock className="w-5 h-5" />
              <div>
                <p className="font-medium text-sm">Free Trial</p>
                <p className="text-xs text-blue-600/80">1 video every 15 minutes</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/sign-up">
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                <Zap className="w-4 h-4 mr-2" />
                Upgrade for Unlimited
              </Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}