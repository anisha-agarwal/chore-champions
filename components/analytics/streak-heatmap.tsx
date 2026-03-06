'use client'

import { useMemo } from 'react'
import { HEATMAP_COLORS } from '@/lib/analytics-constants'
import { getHeatmapIntensity } from '@/lib/analytics-utils'
import type { DailyPoint } from '@/lib/types'

interface StreakHeatmapProps {
  data: DailyPoint[]
  /** On mobile (<640px) show 26 weeks; default is 52 */
  weeks?: number
}

const CELL_SIZE = 11
const CELL_GAP = 2
const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function StreakHeatmap({ data, weeks = 52 }: StreakHeatmapProps) {
  const { grid, monthPositions, maxCompletions, totalCompletions } = useMemo(() => {
    const dateMap = new Map<string, DailyPoint>()
    for (const d of data) {
      dateMap.set(d.date, d)
    }

    const today = new Date()
    const endDate = new Date(today)
    // Align to Saturday (end of week)
    const saturdayOffset = 6 - endDate.getDay()
    endDate.setDate(endDate.getDate() + saturdayOffset)

    // Build grid: 7 rows (Sun-Sat) x weeks cols
    const cells: Array<{ date: string; completions: number; points: number } | null>[] = []
    let total = 0
    let max = 0

    for (let col = weeks - 1; col >= 0; col--) {
      const colCells: Array<{ date: string; completions: number; points: number } | null> = []
      for (let row = 0; row < 7; row++) {
        const d = new Date(endDate)
        d.setDate(endDate.getDate() - col * 7 - (6 - row))
        if (d > today) {
          colCells.push(null)
        } else {
          const iso = d.toISOString().slice(0, 10)
          const point = dateMap.get(iso) ?? { date: iso, completions: 0, points: 0 }
          total += point.completions
          if (point.completions > max) max = point.completions
          colCells.push(point)
        }
      }
      cells.push(colCells)
    }

    // Find month label positions
    const positions: { col: number; month: number }[] = []
    let lastMonth = -1
    for (let col = 0; col < cells.length; col++) {
      const firstCell = cells[col].find((c) => c !== null)
      if (firstCell) {
        const month = new Date(firstCell.date + 'T00:00:00').getMonth()
        if (month !== lastMonth) {
          positions.push({ col, month })
          lastMonth = month
        }
      }
    }

    return { grid: cells, monthPositions: positions, maxCompletions: max, totalCompletions: total }
  }, [data, weeks])

  const cellStep = CELL_SIZE + CELL_GAP
  const svgWidth = weeks * cellStep
  const svgHeight = 7 * cellStep

  return (
    <div>
      <div
        role="img"
        aria-label={`Activity heatmap: ${totalCompletions} total completions over the past ${weeks} weeks`}
      >
        <div className="overflow-x-auto">
          <div style={{ minWidth: svgWidth + 24 }}>
            {/* Month labels */}
            <div className="relative ml-6 mb-1" style={{ height: 12 }}>
              {monthPositions.map(({ col, month }) => (
                <span
                  key={`${col}-${month}`}
                  className="absolute text-xs text-gray-400"
                  style={{ left: col * cellStep, fontSize: 9 }}
                >
                  {MONTH_LABELS[month]}
                </span>
              ))}
            </div>
            <div className="flex gap-1">
              {/* Day labels */}
              <div className="flex flex-col gap-0.5 mr-1">
                {DAY_LABELS.map((label, i) => (
                  <div
                    key={i}
                    className="text-gray-400 flex items-center justify-end"
                    style={{ height: CELL_SIZE, width: 10, fontSize: 8 }}
                  >
                    {i % 2 === 0 ? label : ''}
                  </div>
                ))}
              </div>
              {/* Grid */}
              <svg width={svgWidth} height={svgHeight} aria-hidden="true">
                {grid.map((col, colIdx) =>
                  col.map((cell, rowIdx) => {
                    if (!cell) return null
                    const intensity = getHeatmapIntensity(cell.completions, maxCompletions)
                    const fill = HEATMAP_COLORS[intensity]
                    const x = colIdx * cellStep
                    const y = rowIdx * cellStep
                    return (
                      <rect
                        key={`${colIdx}-${rowIdx}`}
                        x={x}
                        y={y}
                        width={CELL_SIZE}
                        height={CELL_SIZE}
                        rx={2}
                        fill={fill}
                        aria-label={`${cell.date}: ${cell.completions} completions`}
                      >
                        <title>{`${cell.date}: ${cell.completions} quest${cell.completions !== 1 ? 's' : ''} completed`}</title>
                      </rect>
                    )
                  })
                )}
              </svg>
            </div>
            {/* Legend */}
            <div className="flex items-center gap-1 mt-2 ml-6">
              <span className="text-xs text-gray-400 mr-1">Less</span>
              {HEATMAP_COLORS.map((color, i) => (
                <div
                  key={i}
                  style={{ width: CELL_SIZE, height: CELL_SIZE, backgroundColor: color, borderRadius: 2 }}
                />
              ))}
              <span className="text-xs text-gray-400 ml-1">More</span>
            </div>
          </div>
        </div>
      </div>
      {/* Screen-reader summary */}
      <p className="sr-only">
        Activity heatmap showing {totalCompletions} total quest completions over {weeks} weeks.
        Maximum {maxCompletions} completions on any single day.
      </p>
    </div>
  )
}
