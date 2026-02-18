import { renderHook, act } from '@testing-library/react'
import { useEncouragement } from '@/lib/hooks/use-encouragement'
import { toast } from 'sonner'
import type { ShowEncouragementParams } from '@/lib/encouragement'

// Mock sonner
jest.mock('sonner', () => ({
  toast: Object.assign(jest.fn(), {
    success: jest.fn(),
  }),
}))

// Mock fetch globally
const originalFetch = global.fetch

const mockTask = {
  id: 'task-1',
  family_id: 'family-1',
  title: 'Clean Room',
  description: null,
  assigned_to: 'child-1',
  points: 10,
  time_of_day: 'morning' as const,
  recurring: null,
  due_date: '2024-01-15',
  due_time: null,
  completed: false,
  created_by: 'user-1',
  created_at: '2024-01-01T00:00:00Z',
  end_date: null,
  profiles: { id: 'child-1', display_name: 'Timmy', avatar_url: null, nickname: 'Little T' },
}

const mockUser = {
  id: 'child-1',
  family_id: 'family-1',
  display_name: 'Timmy',
  avatar_url: null,
  nickname: 'Little T',
  role: 'child' as const,
  points: 15,
  created_at: '2024-01-01T00:00:00Z',
}

const mockTasks = [
  { ...mockTask, completed: true },
  { ...mockTask, id: 'task-2', title: 'Do Homework', completed: false },
  { ...mockTask, id: 'task-3', title: 'Walk Dog', completed: false },
]

describe('useEncouragement', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('calls API with correct context and shows toast on AI success', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ message: 'Great job Timmy!', isMilestone: false }),
    })

    const { result } = renderHook(() => useEncouragement())

    const params: ShowEncouragementParams = {
      task: mockTask,
      pointsEarned: 10,
      currentUser: mockUser,
      tasks: mockTasks,
    }

    await act(async () => {
      await result.current.showEncouragement(params)
    })

    // Verify fetch was called with the right URL and method
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/ai/encouragement',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
    )

    // Verify the body contains the right context
    const fetchCall = (global.fetch as jest.Mock).mock.calls[0]
    const body = JSON.parse(fetchCall[1].body)
    expect(body.taskTitle).toBe('Clean Room')
    expect(body.pointsEarned).toBe(10)
    expect(body.userName).toBe('Little T') // Uses nickname over display_name

    // Should show regular toast (not milestone)
    expect(toast).toHaveBeenCalledWith('Great job Timmy!', expect.objectContaining({
      duration: 3000,
    }))
  })

  it('shows fallback message when API returns null message', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ message: null }),
    })

    const { result } = renderHook(() => useEncouragement())

    await act(async () => {
      await result.current.showEncouragement({
        task: mockTask,
        pointsEarned: 10,
        currentUser: mockUser,
        tasks: mockTasks,
      })
    })

    expect(toast).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ duration: 3000 })
    )
  })

  it('shows fallback message when API call fails', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'))

    const { result } = renderHook(() => useEncouragement())

    await act(async () => {
      await result.current.showEncouragement({
        task: mockTask,
        pointsEarned: 5,
        currentUser: mockUser,
        tasks: mockTasks,
      })
    })

    expect(toast).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ duration: 3000 })
    )
  })

  it('shows fallback message when API returns non-ok response', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
    })

    const { result } = renderHook(() => useEncouragement())

    await act(async () => {
      await result.current.showEncouragement({
        task: mockTask,
        pointsEarned: 5,
        currentUser: mockUser,
        tasks: mockTasks,
      })
    })

    expect(toast).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ duration: 3000 })
    )
  })

  it('shows success toast for milestone completions', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ message: 'All quests done!', isMilestone: true }),
    })

    // All tasks completed = milestone
    const allDoneTasks = [
      { ...mockTask, completed: true },
      { ...mockTask, id: 'task-2', completed: true },
    ]

    const { result } = renderHook(() => useEncouragement())

    await act(async () => {
      await result.current.showEncouragement({
        task: mockTask,
        pointsEarned: 10,
        currentUser: mockUser,
        tasks: allDoneTasks,
      })
    })

    expect(toast.success).toHaveBeenCalledWith('All quests done!', expect.objectContaining({
      duration: 5000,
    }))
  })

  it('uses display_name when nickname is null', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ message: 'Nice work!' }),
    })

    const userNoNickname = { ...mockUser, nickname: null }

    const { result } = renderHook(() => useEncouragement())

    await act(async () => {
      await result.current.showEncouragement({
        task: mockTask,
        pointsEarned: 5,
        currentUser: userNoNickname,
        tasks: mockTasks,
      })
    })

    const fetchCall = (global.fetch as jest.Mock).mock.calls[0]
    const body = JSON.parse(fetchCall[1].body)
    expect(body.userName).toBe('Timmy')
  })
})
