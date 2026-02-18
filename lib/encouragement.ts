import type { TaskWithAssignee, Profile } from '@/lib/types'

export type EncouragementContext = {
  taskTitle: string
  pointsEarned: number
  totalPoints: number
  completionsToday: number
  totalTasksToday: number
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night'
  userName: string
  isOverdue: boolean
  isMilestone: boolean
  milestoneType: string | null
}

export type ShowEncouragementParams = {
  task: TaskWithAssignee
  pointsEarned: number
  currentUser: Profile
  tasks: TaskWithAssignee[]
}

const GENERAL_MESSAGES = [
  'Great job getting that done!',
  'You crushed it! Keep going!',
  'Another quest complete! You rock!',
  'Way to go, champion!',
  'Look at you go! Unstoppable!',
]

const POINTS_MESSAGES = [
  'Nice! Those points are adding up!',
  'Your point stash is growing fast!',
  'Ka-ching! More points in the bank!',
  'Points earned! You are on a roll!',
  'Every point counts and you just scored!',
]

const ALL_DONE_MESSAGES = [
  'All quests done! You are a superstar!',
  'Everything finished! Time to celebrate!',
  'Clean sweep! Every quest complete!',
  'All done! You are a true champion!',
  'Mission accomplished! Every quest conquered!',
]

export const FALLBACK_MESSAGES = {
  general: GENERAL_MESSAGES,
  points: POINTS_MESSAGES,
  'all-done': ALL_DONE_MESSAGES,
}

/**
 * Selects a contextual fallback message, avoiding recent repeats.
 */
export function getRandomFallback(
  context: Pick<EncouragementContext, 'isMilestone' | 'milestoneType' | 'pointsEarned'>,
  recentMessages: string[] = []
): string {
  // Choose category based on context
  let category: keyof typeof FALLBACK_MESSAGES = 'general'
  if (context.isMilestone && context.milestoneType === 'all-done') {
    category = 'all-done'
  } else if (context.pointsEarned >= 10) {
    category = 'points'
  }

  const pool = FALLBACK_MESSAGES[category]
  // Filter out recently shown messages
  const available = pool.filter((msg) => !recentMessages.includes(msg))
  // If all were recent, reset and use full pool
  const candidates = available.length > 0 ? available : pool

  const index = Math.floor(Math.random() * candidates.length)
  return candidates[index]
}

const POINT_MILESTONES = [50, 100, 250, 500, 1000]

/**
 * Detects whether the current completion triggers a milestone.
 * Returns the milestone type string or null.
 */
export function detectMilestone(context: {
  totalPoints: number
  pointsEarned: number
  completionsToday: number
  totalTasksToday: number
}): { isMilestone: boolean; milestoneType: string | null } {
  // Check "all tasks done today"
  if (
    context.totalTasksToday > 0 &&
    context.completionsToday >= context.totalTasksToday
  ) {
    return { isMilestone: true, milestoneType: 'all-done' }
  }

  // Check point thresholds: did this completion cross a threshold?
  const previousPoints = context.totalPoints - context.pointsEarned
  for (const threshold of POINT_MILESTONES) {
    if (previousPoints < threshold && context.totalPoints >= threshold) {
      return { isMilestone: true, milestoneType: `${threshold}-points` }
    }
  }

  return { isMilestone: false, milestoneType: null }
}

/**
 * Returns the time of day based on the current hour.
 */
export function getTimeOfDay(): 'morning' | 'afternoon' | 'evening' | 'night' {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 12) return 'morning'
  if (hour >= 12 && hour < 17) return 'afternoon'
  if (hour >= 17 && hour < 21) return 'evening'
  return 'night'
}
