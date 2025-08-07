import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Clock, Zap, Gift } from 'lucide-react'
import Link from 'next/link'

export function TrialLimitWidget() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Gift className="w-5 h-5 text-blue-600" />
          Trial Account
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm">Rate Limit</span>
            </div>
            <Badge variant="secondary">1 per 15min</Badge>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm">Videos</span>
            </div>
            <Badge variant="outline">Limited</Badge>
          </div>
        </div>

        <div className="border-t pt-4">
          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              Enjoying TLYT?
            </p>
            <Link href="/sign-up">
              <Button size="sm" className="w-full">
                <Zap className="w-4 h-4 mr-2" />
                Upgrade for Unlimited
              </Button>
            </Link>
          </div>
        </div>

        <div className="text-xs text-muted-foreground text-center">
          Sign up to remove all limits and get full access to all features
        </div>
      </CardContent>
    </Card>
  )
}