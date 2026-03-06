import type { Level } from './types'

export const LEVELS: readonly Level[] = [
  { level: 1, name: 'Rookie', minPoints: 0 },
  { level: 2, name: 'Explorer', minPoints: 100 },
  { level: 3, name: 'Champion', minPoints: 300 },
  { level: 4, name: 'Hero', minPoints: 600 },
  { level: 5, name: 'Legend', minPoints: 1000 },
] as const

export const CHART_COLORS = {
  primary: '#9333ea',    // purple-600
  secondary: '#f59e0b',  // amber-500
  tertiary: '#14b8a6',   // teal-500
  quaternary: '#6366f1', // indigo-500
  quinary: '#f43f5e',    // rose-500
} as const

export const HEATMAP_COLORS = [
  '#f3f4f6', // gray-100 (0 completions)
  '#e9d5ff', // purple-200
  '#c084fc', // purple-400
  '#9333ea', // purple-600
  '#6b21a8', // purple-800
] as const
