'use client'

import { useState } from 'react'
import { cn, getWeekDays, isSameDay } from '@/lib/utils'

interface WeekPickerProps {
  selectedDate: Date
  onDateSelect: (date: Date) => void
}

export function WeekPicker({ selectedDate, onDateSelect }: WeekPickerProps) {
  const [weekStart, setWeekStart] = useState(() => {
    const today = new Date()
    const day = today.getDay()
    const start = new Date(today)
    start.setDate(today.getDate() - day)
    return start
  })

  const weekDays = getWeekDays(weekStart)
  const today = new Date()

  const goToPreviousWeek = () => {
    const newStart = new Date(weekStart)
    newStart.setDate(weekStart.getDate() - 7)
    setWeekStart(newStart)
  }

  const goToNextWeek = () => {
    const newStart = new Date(weekStart)
    newStart.setDate(weekStart.getDate() + 7)
    setWeekStart(newStart)
  }

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  return (
    <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={goToPreviousWeek}
          className="p-1 rounded-lg hover:bg-gray-100 transition"
        >
          <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="text-sm font-medium text-gray-700">
          {weekStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
        </span>
        <button
          onClick={goToNextWeek}
          className="p-1 rounded-lg hover:bg-gray-100 transition"
        >
          <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {weekDays.map((day, index) => {
          const isSelected = isSameDay(day, selectedDate)
          const isToday = isSameDay(day, today)

          return (
            <button
              key={day.toISOString()}
              onClick={() => onDateSelect(day)}
              className={cn(
                'flex flex-col items-center py-2 rounded-lg transition',
                isSelected
                  ? 'bg-purple-600 text-white'
                  : isToday
                  ? 'bg-purple-100 text-purple-600'
                  : 'hover:bg-gray-100 text-gray-700'
              )}
            >
              <span className="text-xs font-medium opacity-70">
                {dayNames[index]}
              </span>
              <span className="text-lg font-semibold">
                {day.getDate()}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
