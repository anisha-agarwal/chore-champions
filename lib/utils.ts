import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Format date for display
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

// Get start of week (Sunday)
export function getStartOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() - day)
  d.setHours(0, 0, 0, 0)
  return d
}

// Get week days starting from a date
export function getWeekDays(startDate: Date): Date[] {
  const days: Date[] = []
  const start = getStartOfWeek(startDate)

  for (let i = 0; i < 7; i++) {
    const day = new Date(start)
    day.setDate(start.getDate() + i)
    days.push(day)
  }

  return days
}

// Check if two dates are the same day
export function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  )
}

// Format date as YYYY-MM-DD using local timezone
export function toDateString(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Get initials from name
export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

// Generate random invite code
export function generateInviteCode(): string {
  return Math.random().toString(36).substring(2, 10).toUpperCase()
}

// Combine a date string (YYYY-MM-DD) and time string (HH:MM:SS) into a Date
export function combineDateAndTime(dateStr: string, timeStr: string): Date {
  const [hours, minutes, seconds] = timeStr.split(':').map(Number)
  const date = new Date(dateStr + 'T00:00:00')
  date.setHours(hours, minutes, seconds || 0, 0)
  return date
}

// Format a time string ("14:30:00") into 12-hour format ("2:30 PM")
export function formatTime(timeStr: string): string {
  const [hours, minutes] = timeStr.split(':').map(Number)
  const period = hours >= 12 ? 'PM' : 'AM'
  const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours
  return `${displayHours}:${String(minutes).padStart(2, '0')} ${period}`
}

// Calculate time remaining until a deadline
export function getTimeRemaining(deadline: Date): {
  totalMinutes: number
  hours: number
  minutes: number
  isOverdue: boolean
  isWarning: boolean
} {
  const now = new Date()
  const diffMs = deadline.getTime() - now.getTime()
  const totalMinutes = Math.floor(diffMs / 60000)
  const isOverdue = totalMinutes < 0
  const absTotalMinutes = Math.abs(totalMinutes)
  const hours = Math.floor(absTotalMinutes / 60)
  const minutes = absTotalMinutes % 60

  return {
    totalMinutes,
    hours,
    minutes,
    isOverdue,
    isWarning: !isOverdue && totalMinutes <= 60,
  }
}

// Format time remaining into a human-readable string
export function formatTimeRemaining(remaining: {
  hours: number
  minutes: number
  isOverdue: boolean
}): string {
  const { hours, minutes, isOverdue } = remaining
  const parts: string[] = []
  if (hours > 0) parts.push(`${hours}h`)
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes}m`)
  const timeStr = parts.join(' ')
  return isOverdue ? `${timeStr} overdue` : `${timeStr} left`
}

// Detect in-app browsers that block Google OAuth
export function isInAppBrowser(userAgent: string): boolean {
  const patterns = [
    'FBAN', 'FBAV',       // Facebook
    'Instagram',           // Instagram
    'WhatsApp',            // WhatsApp
    'Line/',               // Line
    'Twitter',             // Twitter / X
    'LinkedInApp',         // LinkedIn
    'Snapchat',            // Snapchat
    'Pinterest',           // Pinterest
    'MicroMessenger',      // WeChat
  ]
  return patterns.some((p) => userAgent.includes(p))
}

// Convert HTML time input value ("HH:MM") to database format ("HH:MM:SS")
export function toTimeString(timeInput: string): string {
  if (timeInput.split(':').length === 2) {
    return `${timeInput}:00`
  }
  return timeInput
}
