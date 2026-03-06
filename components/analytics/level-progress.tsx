'use client'

import { getLevelProgress } from '@/lib/analytics-utils'
import { CHART_COLORS } from '@/lib/analytics-constants'

interface LevelProgressProps {
  points: number
}

const RADIUS = 40
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export function LevelProgress({ points }: LevelProgressProps) {
  const { current, next, progress } = getLevelProgress(points)
  const pct = Math.round(progress * 100)
  // strokeDashoffset: full circle minus the filled arc
  // lower offset = more filled
  const dashOffset = CIRCUMFERENCE * (1 - progress)

  return (
    <div className="flex items-center gap-4">
      {/* SVG ring */}
      <div className="relative flex items-center justify-center" style={{ width: 100, height: 100 }}>
        <svg width={100} height={100} aria-hidden="true">
          {/* Background ring */}
          <circle
            cx={50}
            cy={50}
            r={RADIUS}
            fill="none"
            stroke="#f3f4f6"
            strokeWidth={10}
          />
          {/* Progress arc */}
          <circle
            cx={50}
            cy={50}
            r={RADIUS}
            fill="none"
            stroke={CHART_COLORS.primary}
            strokeWidth={10}
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            transform="rotate(-90 50 50)"
          />
        </svg>
        {/* Level number in center */}
        <div className="absolute flex flex-col items-center">
          <span className="text-xl font-bold text-gray-900">{current.level}</span>
          <span className="text-xs text-gray-400 -mt-1">Lvl</span>
        </div>
      </div>

      {/* Level info */}
      <div
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Level ${current.level} ${current.name}: ${pct}% progress${next ? ` toward ${next.name}` : ''}`}
      >
        <p className="font-bold text-gray-900 text-lg">{current.name}</p>
        <p className="text-sm text-gray-500">{points.toLocaleString()} points</p>
        {next ? (
          <p className="text-xs text-gray-400 mt-0.5">
            {(next.minPoints - points).toLocaleString()} to {next.name}
          </p>
        ) : (
          <p className="text-xs text-purple-600 mt-0.5 font-medium">Max level reached!</p>
        )}
      </div>
    </div>
  )
}
