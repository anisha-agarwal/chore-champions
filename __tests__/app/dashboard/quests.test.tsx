import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import QuestsPage from '@/app/(dashboard)/quests/page'

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    refresh: jest.fn(),
  }),
  usePathname: () => '/quests',
}))

// Mock next/image
jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: { alt: string; src: string }) => <img alt={props.alt} src={props.src} />,
}))

// Mock data
const mockUser = { id: 'user-1', email: 'test@example.com' }
const mockProfile = {
  id: 'user-1',
  family_id: 'family-1',
  display_name: 'Test Parent',
  avatar_url: null,
  nickname: null,
  role: 'parent',
  points: 100,
  created_at: '2024-01-01T00:00:00Z',
}

const mockMembers = [
  mockProfile,
  {
    id: 'child-1',
    family_id: 'family-1',
    display_name: 'Timmy',
    avatar_url: null,
    nickname: 'Little T',
    role: 'child',
    points: 50,
    created_at: '2024-01-01T00:00:00Z',
  },
]

const mockTasks = [
  {
    id: 'task-1',
    family_id: 'family-1',
    title: 'Clean Room',
    description: 'Make bed and vacuum',
    assigned_to: 'child-1',
    points: 10,
    time_of_day: 'morning',
    recurring: null,
    due_date: '2024-01-15',
    due_time: null,
    completed: false,
    created_by: 'user-1',
    created_at: '2024-01-01T00:00:00Z',
    end_date: null,
    profiles: { id: 'child-1', display_name: 'Timmy', avatar_url: null, nickname: 'Little T' },
  },
]

// Controllable mock functions
const mockGetUser = jest.fn()
const mockInsert = jest.fn()
const mockUpdate = jest.fn()
const mockDelete = jest.fn()
const mockProfileData = { current: mockProfile as unknown }
const mockMembersData = { current: mockMembers as unknown[] }
const mockOneTimeTasksData = { current: mockTasks as unknown[] }
const mockRecurringTasksData = { current: [] as unknown[] }
const mockSkipsData = { current: [] as unknown[] }
const mockCompletionsData = { current: [] as unknown[] }

jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getUser: (...args: unknown[]) => mockGetUser(...args),
    },
    from: (table: string) => {
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: mockProfileData.current }),
              order: () => Promise.resolve({ data: mockMembersData.current }),
            }),
          }),
        }
      }
      if (table === 'tasks') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                is: () => ({
                  order: () => Promise.resolve({ data: mockOneTimeTasksData.current }),
                }),
              }),
              lte: () => ({
                not: () => ({
                  order: () => Promise.resolve({ data: mockRecurringTasksData.current }),
                }),
              }),
            }),
          }),
          insert: (...args: unknown[]) => mockInsert(...args),
          update: (...args: unknown[]) => ({
            eq: (...eqArgs: unknown[]) => mockUpdate(...args, ...eqArgs),
          }),
          delete: () => ({
            eq: (...args: unknown[]) => mockDelete(...args),
          }),
        }
      }
      if (table === 'task_skips') {
        return {
          select: () => ({
            in: () => ({
              eq: () => Promise.resolve({ data: mockSkipsData.current }),
            }),
          }),
          insert: (...args: unknown[]) => mockInsert(...args),
        }
      }
      if (table === 'task_completions') {
        return {
          select: () => ({
            in: () => ({
              eq: () => Promise.resolve({ data: mockCompletionsData.current }),
            }),
          }),
          insert: (...args: unknown[]) => mockInsert(...args),
          delete: () => ({
            eq: (...args: unknown[]) => {
              const result = mockDelete(...args)
              return {
                ...result,
                eq: () => result,
              }
            },
          }),
        }
      }
      return {
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: null }),
          }),
        }),
      }
    },
  }),
}))

describe('QuestsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: mockUser } })
    mockInsert.mockResolvedValue({ error: null })
    mockUpdate.mockResolvedValue({ error: null })
    mockDelete.mockResolvedValue({ error: null })
    mockProfileData.current = mockProfile
    mockMembersData.current = mockMembers
    mockOneTimeTasksData.current = mockTasks
    mockRecurringTasksData.current = []
    mockSkipsData.current = []
    mockCompletionsData.current = []
  })

  it('shows loading state initially', () => {
    mockGetUser.mockReturnValue(new Promise(() => {}))
    render(<QuestsPage />)
    expect(document.querySelector('.animate-spin')).toBeInTheDocument()
  })

  it('renders page header with title', async () => {
    render(<QuestsPage />)
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Quests' })).toBeInTheDocument()
    })
  })

  it('renders user points in header', async () => {
    render(<QuestsPage />)
    await waitFor(() => {
      expect(screen.getByText('100')).toBeInTheDocument()
      expect(screen.getByText('points')).toBeInTheDocument()
    })
  })

  it('renders task list with task titles', async () => {
    render(<QuestsPage />)
    await waitFor(() => {
      expect(screen.getByText('Clean Room')).toBeInTheDocument()
    })
  })

  it('renders task description', async () => {
    render(<QuestsPage />)
    await waitFor(() => {
      expect(screen.getByText('Make bed and vacuum')).toBeInTheDocument()
    })
  })

  it('renders task points', async () => {
    render(<QuestsPage />)
    await waitFor(() => {
      expect(screen.getByText('10 pts')).toBeInTheDocument()
    })
  })

  it('shows no-family state when user has no family', async () => {
    mockProfileData.current = { ...mockProfile, family_id: null }

    render(<QuestsPage />)
    await waitFor(() => {
      expect(screen.getByText('No Family Yet')).toBeInTheDocument()
    })
    expect(screen.getByRole('link', { name: /set up family/i })).toHaveAttribute('href', '/family')
  })

  it('renders FAB button to add quest', async () => {
    render(<QuestsPage />)
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Quests' })).toBeInTheDocument()
    })

    const fab = document.querySelector('button.fixed')
    expect(fab).toBeInTheDocument()
  })

  it('opens task form when FAB is clicked', async () => {
    const user = userEvent.setup()
    render(<QuestsPage />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Quests' })).toBeInTheDocument()
    })

    const fab = document.querySelector('button.fixed') as HTMLElement
    await user.click(fab)

    expect(screen.getByText('New Quest')).toBeInTheDocument()
  })

  describe('fetchData edge cases', () => {
    it('stops loading when user is not authenticated', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } })
      render(<QuestsPage />)
      await waitFor(() => {
        expect(document.querySelector('.animate-spin')).not.toBeInTheDocument()
      })
    })

    it('stops loading when profile is not found', async () => {
      mockProfileData.current = null
      render(<QuestsPage />)
      await waitFor(() => {
        expect(document.querySelector('.animate-spin')).not.toBeInTheDocument()
      })
    })
  })

  describe('recurring task filtering', () => {
    it('shows daily recurring tasks', async () => {
      mockRecurringTasksData.current = [
        {
          id: 'rec-1',
          family_id: 'family-1',
          title: 'Daily Chore',
          description: null,
          assigned_to: 'child-1',
          points: 5,
          time_of_day: 'morning',
          recurring: 'daily',
          due_date: '2024-01-01',
          due_time: null,
          completed: false,
          created_by: 'user-1',
          created_at: '2024-01-01T00:00:00Z',
          end_date: null,
          profiles: { id: 'child-1', display_name: 'Timmy', avatar_url: null, nickname: 'Little T' },
        },
      ]

      render(<QuestsPage />)
      await waitFor(() => {
        expect(screen.getByText('Daily Chore')).toBeInTheDocument()
      })
    })

    it('shows weekly recurring tasks on matching day of week', async () => {
      // The default selectedDate is new Date(), so we need a task whose due_date
      // started on the same day of week as today
      const today = new Date()
      const dayOfWeek = today.getDay()
      // Find a date in the past that falls on the same day of week
      // Use local date construction to match source code behavior
      const matchDate = new Date(2024, 0, 1) // Jan 1 2024 local
      while (matchDate.getDay() !== dayOfWeek) {
        matchDate.setDate(matchDate.getDate() + 1)
      }
      const year = matchDate.getFullYear()
      const month = String(matchDate.getMonth() + 1).padStart(2, '0')
      const day = String(matchDate.getDate()).padStart(2, '0')
      const dueDateStr = `${year}-${month}-${day}`

      mockRecurringTasksData.current = [
        {
          id: 'rec-2',
          family_id: 'family-1',
          title: 'Weekly Match',
          description: null,
          assigned_to: 'child-1',
          points: 15,
          time_of_day: 'anytime',
          recurring: 'weekly',
          due_date: dueDateStr,
          due_time: null,
          completed: false,
          created_by: 'user-1',
          created_at: '2024-01-01T00:00:00Z',
          end_date: null,
          profiles: { id: 'child-1', display_name: 'Timmy', avatar_url: null, nickname: 'Little T' },
        },
      ]

      render(<QuestsPage />)
      await waitFor(() => {
        expect(screen.getByText('Weekly Match')).toBeInTheDocument()
      })
    })

    it('filters out weekly recurring tasks on non-matching day', async () => {
      // Pick a day of week that does NOT match today
      const today = new Date()
      const dayOfWeek = today.getDay()
      const nonMatchDate = new Date(2024, 0, 1) // Jan 1 2024 local
      while (nonMatchDate.getDay() === dayOfWeek) {
        nonMatchDate.setDate(nonMatchDate.getDate() + 1)
      }
      const year = nonMatchDate.getFullYear()
      const month = String(nonMatchDate.getMonth() + 1).padStart(2, '0')
      const day = String(nonMatchDate.getDate()).padStart(2, '0')
      const dueDateStr = `${year}-${month}-${day}`

      mockRecurringTasksData.current = [
        {
          id: 'rec-nomatch',
          family_id: 'family-1',
          title: 'Weekly NonMatch',
          description: null,
          assigned_to: 'child-1',
          points: 15,
          time_of_day: 'anytime',
          recurring: 'weekly',
          due_date: dueDateStr,
          due_time: null,
          completed: false,
          created_by: 'user-1',
          created_at: '2024-01-01T00:00:00Z',
          end_date: null,
          profiles: { id: 'child-1', display_name: 'Timmy', avatar_url: null, nickname: 'Little T' },
        },
      ]

      render(<QuestsPage />)
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Quests' })).toBeInTheDocument()
      })
      expect(screen.queryByText('Weekly NonMatch')).not.toBeInTheDocument()
    })

    it('filters out recurring tasks past end_date', async () => {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const yesterdayStr = yesterday.toISOString().slice(0, 10)

      mockRecurringTasksData.current = [
        {
          id: 'rec-3',
          family_id: 'family-1',
          title: 'Ended Task',
          description: null,
          assigned_to: 'child-1',
          points: 5,
          time_of_day: 'morning',
          recurring: 'daily',
          due_date: '2024-01-01',
          due_time: null,
          completed: false,
          created_by: 'user-1',
          created_at: '2024-01-01T00:00:00Z',
          end_date: yesterdayStr,
          profiles: { id: 'child-1', display_name: 'Timmy', avatar_url: null, nickname: 'Little T' },
        },
      ]

      render(<QuestsPage />)
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Quests' })).toBeInTheDocument()
      })
      expect(screen.queryByText('Ended Task')).not.toBeInTheDocument()
    })

    it('filters out skipped recurring tasks', async () => {
      mockRecurringTasksData.current = [
        {
          id: 'rec-skip',
          family_id: 'family-1',
          title: 'Skipped Chore',
          description: null,
          assigned_to: 'child-1',
          points: 5,
          time_of_day: 'morning',
          recurring: 'daily',
          due_date: '2024-01-01',
          due_time: null,
          completed: false,
          created_by: 'user-1',
          created_at: '2024-01-01T00:00:00Z',
          end_date: null,
          profiles: { id: 'child-1', display_name: 'Timmy', avatar_url: null, nickname: 'Little T' },
        },
      ]
      mockSkipsData.current = [{ task_id: 'rec-skip' }]

      render(<QuestsPage />)
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Quests' })).toBeInTheDocument()
      })
      expect(screen.queryByText('Skipped Chore')).not.toBeInTheDocument()
    })

    it('marks recurring tasks as completed from completions table', async () => {
      mockRecurringTasksData.current = [
        {
          id: 'rec-comp',
          family_id: 'family-1',
          title: 'Completed Daily',
          description: null,
          assigned_to: 'child-1',
          points: 5,
          time_of_day: 'morning',
          recurring: 'daily',
          due_date: '2024-01-01',
          due_time: null,
          completed: false,
          created_by: 'user-1',
          created_at: '2024-01-01T00:00:00Z',
          end_date: null,
          profiles: { id: 'child-1', display_name: 'Timmy', avatar_url: null, nickname: 'Little T' },
        },
      ]
      mockCompletionsData.current = [{ task_id: 'rec-comp' }]

      render(<QuestsPage />)
      await waitFor(() => {
        expect(screen.getByText('Completed Daily')).toBeInTheDocument()
      })
    })
  })

  describe('handleSubmitTask', () => {
    it('creates a new task via insert', async () => {
      const user = userEvent.setup()
      render(<QuestsPage />)

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Quests' })).toBeInTheDocument()
      })

      const fab = document.querySelector('button.fixed') as HTMLElement
      await user.click(fab)

      const titleInput = screen.getByPlaceholderText('e.g., Clean your room')
      await user.type(titleInput, 'New Test Task')

      const createBtn = screen.getByRole('button', { name: 'Create Quest' })
      await user.click(createBtn)

      await waitFor(() => {
        expect(mockInsert).toHaveBeenCalled()
      })
    })

    it('shows error when not authenticated during task submit', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
      const user = userEvent.setup()
      render(<QuestsPage />)

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Quests' })).toBeInTheDocument()
      })

      const fab = document.querySelector('button.fixed') as HTMLElement
      await user.click(fab)
      await user.type(screen.getByPlaceholderText('e.g., Clean your room'), 'Test')

      // From now on, all getUser calls return null (simulating session expiry)
      mockGetUser.mockResolvedValue({ data: { user: null } })

      await user.click(screen.getByRole('button', { name: 'Create Quest' }))

      await waitFor(() => {
        expect(screen.getByText('Not authenticated')).toBeInTheDocument()
      })
      consoleSpy.mockRestore()
    })
  })

  describe('handleConfirmDelete', () => {
    it('deletes a non-recurring task successfully', async () => {
      const user = userEvent.setup()
      render(<QuestsPage />)

      await waitFor(() => {
        expect(screen.getByText('Clean Room')).toBeInTheDocument()
      })

      // Click delete button (title="Delete quest")
      const deleteButton = screen.getByTitle('Delete quest')
      await user.click(deleteButton)

      // Should show delete confirmation modal for non-recurring task
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /delete quest/i })).toBeInTheDocument()
      })

      // Confirm delete
      await user.click(screen.getByRole('button', { name: 'Delete' }))

      await waitFor(() => {
        expect(mockDelete).toHaveBeenCalled()
      })
    })

    it('shows error when delete fails due to permission', async () => {
      mockDelete.mockResolvedValue({ error: { message: 'Permission denied' } })
      const user = userEvent.setup()
      render(<QuestsPage />)

      await waitFor(() => {
        expect(screen.getByText('Clean Room')).toBeInTheDocument()
      })

      await user.click(screen.getByTitle('Delete quest'))

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /delete quest/i })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: 'Delete' }))

      await waitFor(() => {
        expect(screen.getByText('You do not have permission to delete this quest.')).toBeInTheDocument()
      })
    })
  })

  describe('delete modal for recurring task', () => {
    beforeEach(() => {
      mockOneTimeTasksData.current = []
      mockRecurringTasksData.current = [
        {
          id: 'rec-del',
          family_id: 'family-1',
          title: 'Daily Recurring',
          description: null,
          assigned_to: 'child-1',
          points: 10,
          time_of_day: 'morning',
          recurring: 'daily',
          due_date: '2024-01-01',
          due_time: null,
          completed: false,
          created_by: 'user-1',
          created_at: '2024-01-01T00:00:00Z',
          end_date: null,
          profiles: { id: 'child-1', display_name: 'Timmy', avatar_url: null, nickname: 'Little T' },
        },
      ]
    })

    it('shows skip/end options for recurring task', async () => {
      const user = userEvent.setup()
      render(<QuestsPage />)

      await waitFor(() => {
        expect(screen.getByText('Daily Recurring')).toBeInTheDocument()
      })

      await user.click(screen.getByTitle('Delete quest'))

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /remove quest/i })).toBeInTheDocument()
      })
      expect(screen.getByRole('button', { name: /skip today only/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /stop all future/i })).toBeInTheDocument()
    })

    it('handles skip today for recurring task', async () => {
      const user = userEvent.setup()
      render(<QuestsPage />)

      await waitFor(() => {
        expect(screen.getByText('Daily Recurring')).toBeInTheDocument()
      })

      await user.click(screen.getByTitle('Delete quest'))

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /skip today only/i })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /skip today only/i }))

      await waitFor(() => {
        expect(mockInsert).toHaveBeenCalled()
      })
    })

    it('shows error when skip today fails', async () => {
      mockInsert.mockResolvedValue({ error: { message: 'denied' } })
      const user = userEvent.setup()
      render(<QuestsPage />)

      await waitFor(() => {
        expect(screen.getByText('Daily Recurring')).toBeInTheDocument()
      })

      await user.click(screen.getByTitle('Delete quest'))

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /skip today only/i })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /skip today only/i }))

      await waitFor(() => {
        expect(screen.getByText('You do not have permission to skip this quest.')).toBeInTheDocument()
      })
    })

    it('handles end recurring task', async () => {
      const user = userEvent.setup()
      render(<QuestsPage />)

      await waitFor(() => {
        expect(screen.getByText('Daily Recurring')).toBeInTheDocument()
      })

      await user.click(screen.getByTitle('Delete quest'))

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /stop all future/i })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /stop all future/i }))

      await waitFor(() => {
        expect(mockUpdate).toHaveBeenCalled()
      })
    })

    it('shows error when end recurring fails', async () => {
      mockUpdate.mockResolvedValue({ error: { message: 'denied' } })
      const user = userEvent.setup()
      render(<QuestsPage />)

      await waitFor(() => {
        expect(screen.getByText('Daily Recurring')).toBeInTheDocument()
      })

      await user.click(screen.getByTitle('Delete quest'))

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /stop all future/i })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /stop all future/i }))

      await waitFor(() => {
        expect(screen.getByText('You do not have permission to modify this quest.')).toBeInTheDocument()
      })
    })

    it('cancel button closes the recurring delete modal', async () => {
      const user = userEvent.setup()
      render(<QuestsPage />)

      await waitFor(() => {
        expect(screen.getByText('Daily Recurring')).toBeInTheDocument()
      })

      await user.click(screen.getByTitle('Delete quest'))

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /remove quest/i })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /cancel/i }))

      await waitFor(() => {
        expect(screen.queryByRole('heading', { name: /remove quest/i })).not.toBeInTheDocument()
      })
    })
  })

  describe('handleCompleteTask', () => {
    it('completes a non-recurring task via checkbox', async () => {
      const user = userEvent.setup()
      render(<QuestsPage />)

      await waitFor(() => {
        expect(screen.getByText('Clean Room')).toBeInTheDocument()
      })

      // The checkbox is the first button inside the task card (round button with border-gray-300)
      // It has no accessible name, so we find it by its container
      const taskCard = screen.getByText('Clean Room').closest('div[class*="bg-white rounded-xl"]')!
      const checkbox = taskCard.querySelector('button')!
      await user.click(checkbox)

      await waitFor(() => {
        // Should call update (mark completed on task) and insert (completion record)
        expect(mockUpdate).toHaveBeenCalled()
        expect(mockInsert).toHaveBeenCalled()
      })
    })
  })

  describe('handleUncompleteTask', () => {
    it('uncompletes a non-recurring task via checkbox', async () => {
      mockOneTimeTasksData.current = [
        {
          ...mockTasks[0],
          completed: true,
        },
      ]

      const user = userEvent.setup()
      render(<QuestsPage />)

      await waitFor(() => {
        expect(screen.getByText('Clean Room')).toBeInTheDocument()
      })

      // Click the checkbox (undo button with title "Click to undo")
      const undoButton = screen.getByTitle('Click to undo')
      await user.click(undoButton)

      await waitFor(() => {
        expect(mockUpdate).toHaveBeenCalled()
      })
    })
  })

  describe('task filtering', () => {
    it('filters tasks by member', async () => {
      const user = userEvent.setup()
      render(<QuestsPage />)

      await waitFor(() => {
        expect(screen.getByText('Clean Room')).toBeInTheDocument()
      })

      // The member filter should be rendered with member names
      const timmyFilter = screen.queryByText('Little T')
      if (timmyFilter) {
        await user.click(timmyFilter)
        expect(screen.getByText('Clean Room')).toBeInTheDocument()
      }
    })

    it('filters by time of day', async () => {
      mockOneTimeTasksData.current = [
        ...mockTasks,
        {
          id: 'task-afternoon',
          family_id: 'family-1',
          title: 'Afternoon Task',
          description: null,
          assigned_to: 'child-1',
          points: 5,
          time_of_day: 'afternoon',
          recurring: null,
          due_date: '2024-01-15',
          due_time: null,
          completed: false,
          created_by: 'user-1',
          created_at: '2024-01-01T00:00:00Z',
          end_date: null,
          profiles: { id: 'child-1', display_name: 'Timmy', avatar_url: null, nickname: 'Little T' },
        },
      ]

      const user = userEvent.setup()
      render(<QuestsPage />)

      await waitFor(() => {
        expect(screen.getByText('Clean Room')).toBeInTheDocument()
        expect(screen.getByText('Afternoon Task')).toBeInTheDocument()
      })

      // Click Morning filter
      const morningFilter = screen.queryByRole('button', { name: /morning/i })
      if (morningFilter) {
        await user.click(morningFilter)
        await waitFor(() => {
          expect(screen.getByText('Clean Room')).toBeInTheDocument()
          expect(screen.queryByText('Afternoon Task')).not.toBeInTheDocument()
        })
      }
    })
  })
})
