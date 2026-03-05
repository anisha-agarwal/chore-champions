'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface FreezeSectionProps {
  available: number
  used: number
  userPoints: number
  onBuy: () => Promise<void>
}

export function FreezeSection({ available, used, userPoints, onBuy }: FreezeSectionProps) {
  const [buying, setBuying] = useState(false)
  const remaining = available - used

  async function handleBuy() {
    setBuying(true)
    try {
      await onBuy()
    } finally {
      setBuying(false)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2">
          <span aria-hidden="true">❄️</span>
          <span>Streak Freezes</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm text-gray-600">
              Available: <span className="font-bold text-gray-900" data-testid="freeze-count">{remaining}</span>
            </p>
            <p className="text-xs text-gray-400">Protect your streak when you miss a day</p>
          </div>
        </div>
        <Button
          onClick={handleBuy}
          loading={buying}
          disabled={userPoints < 50}
          size="sm"
          className="w-full"
        >
          Buy Freeze (50 pts)
        </Button>
        {userPoints < 50 && (
          <p className="text-xs text-amber-600 mt-1 text-center">
            Need {50 - userPoints} more points
          </p>
        )}
      </CardContent>
    </Card>
  )
}
