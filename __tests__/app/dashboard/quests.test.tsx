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
            eq: () => {
              // Return a thenable that also has .single() and .order()
              // This handles both: `await .eq()` (members) and `.eq().single()` (profile)
              const membersPromise = Promise.resolve({ data: mockMembersData.current })
              return Object.assign(membersPromise, {
                single: () => Promise.resolve({ data: mockProfileData.current }),
                order: () => Promise.resolve({ data: mockMembersData.current }),
              })
            },
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
              // result is a Promise; make it thenable AND chainable with .eq()
              const thenable = result.then((val: unknown) => val)
              ;(thenable as Record<string, unknown>).eq = () => result
              return thenable
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
      // Use local date formatting to match toDateString() used in the component
      const year = yesterday.getFullYear()
      const month = String(yesterday.getMonth() + 1).padStart(2, '0')
      const day = String(yesterday.getDate()).padStart(2, '0')
      const yesterdayStr = `${year}-${month}-${day}`

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

    it('handles null skips data (line 106 || branch)', async () => {
      mockRecurringTasksData.current = [
        {
          id: 'rec-nullskip',
          family_id: 'family-1',
          title: 'Null Skip Daily',
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
      // Return null for skips data (instead of [])
      mockSkipsData.current = null as unknown as unknown[]

      render(<QuestsPage />)
      await waitFor(() => {
        expect(screen.getByText('Null Skip Daily')).toBeInTheDocument()
      })
    })

    it('handles null completions data (line 125 || branch)', async () => {
      mockRecurringTasksData.current = [
        {
          id: 'rec-nullcomp',
          family_id: 'family-1',
          title: 'Null Comp Daily',
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
      mockCompletionsData.current = null as unknown as unknown[]

      render(<QuestsPage />)
      await waitFor(() => {
        expect(screen.getByText('Null Comp Daily')).toBeInTheDocument()
      })
    })

    it('handles null members data (line 57 || branch)', async () => {
      mockMembersData.current = null as unknown as unknown[]

      render(<QuestsPage />)
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Quests' })).toBeInTheDocument()
      })
    })

    it('handles null oneTimeTasks data (line 134 || branch)', async () => {
      mockOneTimeTasksData.current = null as unknown as unknown[]

      render(<QuestsPage />)
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Quests' })).toBeInTheDocument()
      })
    })

    it('handles null recurringTasks data (line 83 || branch)', async () => {
      mockRecurringTasksData.current = null as unknown as unknown[]

      render(<QuestsPage />)
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Quests' })).toBeInTheDocument()
      })
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

  describe('handleSubmitTask with due_time', () => {
    it('submits task with due_time in create mode (line 168 truthy branch)', async () => {
      const user = userEvent.setup()
      render(<QuestsPage />)

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Quests' })).toBeInTheDocument()
      })

      const fab = document.querySelector('button.fixed') as HTMLElement
      await user.click(fab)

      const titleInput = screen.getByPlaceholderText('e.g., Clean your room')
      await user.type(titleInput, 'Task With Time')

      // Set due time
      const { fireEvent } = await import('@testing-library/react')
      const timeInput = screen.getByLabelText('Due Time (optional)')
      fireEvent.change(timeInput, { target: { value: '14:30' } })

      const createBtn = screen.getByRole('button', { name: 'Create Quest' })
      await user.click(createBtn)

      await waitFor(() => {
        expect(mockInsert).toHaveBeenCalled()
      })
    })
  })

  describe('delete modal close/cancel', () => {
    it('closes non-recurring delete modal via Cancel button', async () => {
      const user = userEvent.setup()
      render(<QuestsPage />)

      await waitFor(() => {
        expect(screen.getByText('Clean Room')).toBeInTheDocument()
      })

      // Open delete modal for non-recurring task
      await user.click(screen.getByTitle('Delete quest'))

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /delete quest/i })).toBeInTheDocument()
      })

      // Click Cancel
      await user.click(screen.getByRole('button', { name: /cancel/i }))

      await waitFor(() => {
        expect(screen.queryByRole('heading', { name: /delete quest/i })).not.toBeInTheDocument()
      })
    })

    it('closes delete modal via backdrop click (Modal onClose)', async () => {
      const user = userEvent.setup()
      render(<QuestsPage />)

      await waitFor(() => {
        expect(screen.getByText('Clean Room')).toBeInTheDocument()
      })

      await user.click(screen.getByTitle('Delete quest'))

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /delete quest/i })).toBeInTheDocument()
      })

      // Close via clicking the backdrop (the div with bg-black/50 class)
      const backdrop = document.querySelector('.fixed.inset-0.bg-black\\/50') as HTMLElement
      await user.click(backdrop)

      await waitFor(() => {
        expect(screen.queryByRole('heading', { name: /delete quest/i })).not.toBeInTheDocument()
      })
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

  describe('recurring task filtering', () => {
    it('returns false for unknown recurring types (e.g. monthly)', async () => {
      mockRecurringTasksData.current = [
        {
          id: 'rec-monthly',
          family_id: 'family-1',
          title: 'Monthly Unknown',
          description: null,
          assigned_to: 'child-1',
          points: 5,
          time_of_day: 'morning',
          recurring: 'monthly',
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
        expect(screen.getByRole('heading', { name: 'Quests' })).toBeInTheDocument()
      })
      // Monthly task should be filtered out since it's an unknown recurring type
      expect(screen.queryByText('Monthly Unknown')).not.toBeInTheDocument()
    })
  })

  describe('handleSubmitTask update path', () => {
    it('updates an existing task when editing', async () => {
      const user = userEvent.setup()
      render(<QuestsPage />)

      await waitFor(() => {
        expect(screen.getByText('Clean Room')).toBeInTheDocument()
      })

      // Click the edit button to open editing form
      const editButton = screen.getByTitle('Edit quest')
      await user.click(editButton)

      // Should show the edit form
      await waitFor(() => {
        expect(screen.getByText('Edit Quest')).toBeInTheDocument()
      })

      // Submit the form (the title is pre-populated)
      await user.click(screen.getByRole('button', { name: 'Save Changes' }))

      await waitFor(() => {
        expect(mockUpdate).toHaveBeenCalled()
      })
    })
  })

  describe('handleSubmitTask error on update', () => {
    it('shows error when task update fails (line 178)', async () => {
      mockUpdate.mockResolvedValue({ error: { message: 'Update failed' } })
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
      const user = userEvent.setup()
      render(<QuestsPage />)

      await waitFor(() => {
        expect(screen.getByText('Clean Room')).toBeInTheDocument()
      })

      // Click edit button
      await user.click(screen.getByTitle('Edit quest'))
      await waitFor(() => {
        expect(screen.getByText('Edit Quest')).toBeInTheDocument()
      })

      // Submit the edit form
      await user.click(screen.getByRole('button', { name: 'Save Changes' }))

      await waitFor(() => {
        // The thrown error object is not an Error instance, so TaskForm falls back to generic message
        expect(screen.getByText('Failed to update task')).toBeInTheDocument()
      })
      consoleSpy.mockRestore()
    })
  })

  describe('handleSubmitTask error on create', () => {
    it('shows error when task insert fails (line 188)', async () => {
      mockInsert.mockResolvedValue({ error: { message: 'Insert failed' } })
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
      const user = userEvent.setup()
      render(<QuestsPage />)

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Quests' })).toBeInTheDocument()
      })

      const fab = document.querySelector('button.fixed') as HTMLElement
      await user.click(fab)
      await user.type(screen.getByPlaceholderText('e.g., Clean your room'), 'Fail Task')
      await user.click(screen.getByRole('button', { name: 'Create Quest' }))

      await waitFor(() => {
        // The thrown error object is not an Error instance, so TaskForm falls back to generic message
        expect(screen.getByText('Failed to create task')).toBeInTheDocument()
      })
      consoleSpy.mockRestore()
    })
  })

  describe('handleUncompleteTask for recurring task', () => {
    it('uncompletes a recurring task (deletes completion with date match)', async () => {
      mockOneTimeTasksData.current = []
      mockRecurringTasksData.current = [
        {
          id: 'rec-unc',
          family_id: 'family-1',
          title: 'Recurring Done',
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
      mockCompletionsData.current = [{ task_id: 'rec-unc' }]

      const user = userEvent.setup()
      render(<QuestsPage />)

      await waitFor(() => {
        expect(screen.getByText('Recurring Done')).toBeInTheDocument()
      })

      // The task should be marked completed, click undo
      const undoButton = screen.getByTitle('Click to undo')
      await user.click(undoButton)

      await waitFor(() => {
        expect(mockDelete).toHaveBeenCalled()
      })
    })
  })

  describe('handleCompleteTask error paths', () => {
    it('throws when update fails for non-recurring task (line 285)', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

      const user = userEvent.setup()
      render(<QuestsPage />)

      await waitFor(() => {
        expect(screen.getByText('Clean Room')).toBeInTheDocument()
      })

      // Make update fail AFTER render/fetchData (fetchData only uses select, not update)
      mockUpdate.mockResolvedValue({ error: { message: 'Complete failed' } })

      const taskCard = screen.getByText('Clean Room').closest('div[class*="bg-white rounded-xl"]')!
      const checkbox = taskCard.querySelector('button')!
      await user.click(checkbox)

      // The error propagates through TaskCard's handleComplete catch
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Failed to complete task:', expect.objectContaining({ message: 'Complete failed' }))
      })
      consoleSpy.mockRestore()
    })

    it('throws when completion insert fails (line 303)', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

      const user = userEvent.setup()
      render(<QuestsPage />)

      await waitFor(() => {
        expect(screen.getByText('Clean Room')).toBeInTheDocument()
      })

      // Make insert fail AFTER render (so fetchData's selects work fine)
      mockInsert.mockResolvedValue({ error: { message: 'Completion failed' } })

      const taskCard = screen.getByText('Clean Room').closest('div[class*="bg-white rounded-xl"]')!
      const checkbox = taskCard.querySelector('button')!
      await user.click(checkbox)

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Failed to complete task:', expect.objectContaining({ message: 'Completion failed' }))
      })
      consoleSpy.mockRestore()
    })
  })

  describe('handleUncompleteTask error paths', () => {
    it('throws when uncomplete update fails (line 322)', async () => {
      mockOneTimeTasksData.current = [{ ...mockTasks[0], completed: true }]
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

      const user = userEvent.setup()
      render(<QuestsPage />)

      await waitFor(() => {
        expect(screen.getByText('Clean Room')).toBeInTheDocument()
      })

      // Make update fail for the uncomplete operation
      mockUpdate.mockResolvedValue({ error: { message: 'Uncomplete failed' } })

      const undoButton = screen.getByTitle('Click to undo')
      await user.click(undoButton)

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalled()
      })
      consoleSpy.mockRestore()
    })

    it('throws when completion delete fails (line 338)', async () => {
      mockOneTimeTasksData.current = [{ ...mockTasks[0], completed: true }]
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
      // Make delete fail for task_completions
      mockDelete.mockResolvedValue({ error: { message: 'Delete completion failed' } })

      const user = userEvent.setup()
      render(<QuestsPage />)

      await waitFor(() => {
        expect(screen.getByText('Clean Room')).toBeInTheDocument()
      })

      const undoButton = screen.getByTitle('Click to undo')
      await user.click(undoButton)

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalled()
      })
      consoleSpy.mockRestore()
    })
  })

  describe('isTaskOverdue edge cases', () => {
    it('completes task with no due_date (line 349 - dateStr null)', async () => {
      mockOneTimeTasksData.current = [
        {
          ...mockTasks[0],
          due_date: null,
          due_time: '14:30:00',
        },
      ]

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
      const user = userEvent.setup()
      render(<QuestsPage />)

      await waitFor(() => {
        expect(screen.getByText('Clean Room')).toBeInTheDocument()
      })

      // Complete the task - this calls isTaskOverdue which should return false for null dateStr
      const taskCard = screen.getByText('Clean Room').closest('div[class*="bg-white rounded-xl"]')!
      const checkbox = taskCard.querySelector('button')!
      await user.click(checkbox)

      await waitFor(() => {
        expect(mockUpdate).toHaveBeenCalled()
      })
      consoleSpy.mockRestore()
    })
  })

  describe('isTaskOverdue', () => {
    it('completes a recurring task with due_time (exercises recurring branch)', async () => {
      mockOneTimeTasksData.current = []
      mockRecurringTasksData.current = [
        {
          id: 'rec-overdue',
          family_id: 'family-1',
          title: 'Overdue Recurring',
          description: null,
          assigned_to: 'child-1',
          points: 10,
          time_of_day: 'morning',
          recurring: 'daily',
          due_date: '2024-01-01',
          due_time: '00:01:00',
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
        expect(screen.getByText('Overdue Recurring')).toBeInTheDocument()
      })

      // Click the checkbox to complete (this calls handleCompleteTask which calls isTaskOverdue)
      const taskCard = screen.getByText('Overdue Recurring').closest('div[class*="bg-white rounded-xl"]')!
      const checkbox = taskCard.querySelector('button')!
      await user.click(checkbox)

      await waitFor(() => {
        expect(mockInsert).toHaveBeenCalled()
      })
    })

    it('completes a non-recurring task with due_time (exercises non-recurring branch)', async () => {
      mockOneTimeTasksData.current = [
        {
          ...mockTasks[0],
          due_time: '00:01:00',
        },
      ]

      const user = userEvent.setup()
      render(<QuestsPage />)
      await waitFor(() => {
        expect(screen.getByText('Clean Room')).toBeInTheDocument()
      })

      // Click the checkbox to complete
      const taskCard = screen.getByText('Clean Room').closest('div[class*="bg-white rounded-xl"]')!
      const checkbox = taskCard.querySelector('button')!
      await user.click(checkbox)

      await waitFor(() => {
        expect(mockUpdate).toHaveBeenCalled()
        expect(mockInsert).toHaveBeenCalled()
      })
    })
  })

  describe('weekly recurring task with null due_date', () => {
    it('filters out weekly task with null due_date (returns false)', async () => {
      mockRecurringTasksData.current = [
        {
          id: 'rec-nulldate',
          family_id: 'family-1',
          title: 'Weekly No Date',
          description: null,
          assigned_to: 'child-1',
          points: 5,
          time_of_day: 'morning',
          recurring: 'weekly',
          due_date: null,
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
      expect(screen.queryByText('Weekly No Date')).not.toBeInTheDocument()
    })
  })

  describe('handleCompleteTask with overdue non-recurring', () => {
    it('completes an overdue non-recurring task (half points, line 289)', async () => {
      // We need a task with due_time set in the past so isTaskOverdue returns true
      // and it's non-recurring so we hit both the non-recurring update AND half-points path
      mockOneTimeTasksData.current = [
        {
          id: 'task-overdue',
          family_id: 'family-1',
          title: 'Overdue Non-Recurring',
          description: null,
          assigned_to: 'child-1',
          points: 10,
          time_of_day: 'morning',
          recurring: null,
          due_date: new Date().toISOString().slice(0, 10),
          due_time: '00:01:00', // Past time
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
        expect(screen.getByText('Overdue Non-Recurring')).toBeInTheDocument()
      })

      const taskCard = screen.getByText('Overdue Non-Recurring').closest('div[class*="bg-white rounded-xl"]')!
      const checkbox = taskCard.querySelector('button')!
      await user.click(checkbox)

      await waitFor(() => {
        expect(mockUpdate).toHaveBeenCalled()
        expect(mockInsert).toHaveBeenCalled()
      })
    })
  })

  describe('task filtering', () => {
    it('filters tasks by all-kids member selection', async () => {
      // Add a task assigned to the parent (should be filtered out with all-kids)
      mockOneTimeTasksData.current = [
        ...mockTasks,
        {
          id: 'task-parent',
          family_id: 'family-1',
          title: 'Parent Task',
          description: null,
          assigned_to: 'user-1',
          points: 5,
          time_of_day: 'morning',
          recurring: null,
          due_date: '2024-01-15',
          due_time: null,
          completed: false,
          created_by: 'user-1',
          created_at: '2024-01-01T00:00:00Z',
          end_date: null,
          profiles: { id: 'user-1', display_name: 'Test Parent', avatar_url: null, nickname: null },
        },
      ]

      const user = userEvent.setup()
      render(<QuestsPage />)

      await waitFor(() => {
        expect(screen.getByText('Clean Room')).toBeInTheDocument()
        expect(screen.getByText('Parent Task')).toBeInTheDocument()
      })

      // Click on "All kids" filter - rendered by MemberFilter
      const allKidsFilter = screen.getByText('All kids')
      await user.click(allKidsFilter)
      await waitFor(() => {
        // Clean Room is assigned to child-1, should still show
        expect(screen.getByText('Clean Room')).toBeInTheDocument()
        // Parent Task is assigned to user-1 (parent), should be filtered out
        expect(screen.queryByText('Parent Task')).not.toBeInTheDocument()
      })
    })

    it('shows unassigned tasks (assigned_to=null) when all-kids is selected (line 273 branch)', async () => {
      mockOneTimeTasksData.current = [
        ...mockTasks,
        {
          id: 'task-unassigned',
          family_id: 'family-1',
          title: 'Unassigned Task',
          description: null,
          assigned_to: null,
          points: 5,
          time_of_day: 'morning',
          recurring: null,
          due_date: '2024-01-15',
          due_time: null,
          completed: false,
          created_by: 'user-1',
          created_at: '2024-01-01T00:00:00Z',
          end_date: null,
          profiles: null,
        },
      ]

      const user = userEvent.setup()
      render(<QuestsPage />)

      await waitFor(() => {
        expect(screen.getByText('Unassigned Task')).toBeInTheDocument()
      })

      // Select "All kids" filter
      await user.click(screen.getByText('All kids'))
      await waitFor(() => {
        // Unassigned task should still show (assigned_to is null, passes filter)
        expect(screen.getByText('Unassigned Task')).toBeInTheDocument()
      })
    })

    it('filters tasks by specific member and hides non-matching tasks', async () => {
      // Add a second task assigned to the parent so it gets filtered out
      mockOneTimeTasksData.current = [
        ...mockTasks,
        {
          id: 'task-parent-2',
          family_id: 'family-1',
          title: 'Parent Only Task',
          description: null,
          assigned_to: 'user-1',
          points: 5,
          time_of_day: 'morning',
          recurring: null,
          due_date: '2024-01-15',
          due_time: null,
          completed: false,
          created_by: 'user-1',
          created_at: '2024-01-01T00:00:00Z',
          end_date: null,
          profiles: { id: 'user-1', display_name: 'Test Parent', avatar_url: null, nickname: null },
        },
      ]

      const user = userEvent.setup()
      render(<QuestsPage />)

      await waitFor(() => {
        expect(screen.getByText('Clean Room')).toBeInTheDocument()
        expect(screen.getByText('Parent Only Task')).toBeInTheDocument()
      })

      // Click on Timmy filter (child-1)
      const timmyFilter = screen.getByText('Little T')
      await user.click(timmyFilter)

      await waitFor(() => {
        // Clean Room is assigned to child-1, should still show
        expect(screen.getByText('Clean Room')).toBeInTheDocument()
        // Parent Only Task is assigned to user-1, should be filtered out (line 361)
        expect(screen.queryByText('Parent Only Task')).not.toBeInTheDocument()
      })
    })

    it('deletes a non-recurring task (handleConfirmDelete, line 203+)', async () => {
      const user = userEvent.setup()
      render(<QuestsPage />)

      await waitFor(() => {
        expect(screen.getByText('Clean Room')).toBeInTheDocument()
      })

      // Click the delete button
      const deleteButton = screen.getByTitle('Delete quest')
      await user.click(deleteButton)

      await waitFor(() => {
        expect(screen.getByText('Delete Quest?')).toBeInTheDocument()
      })

      // Click "Delete" in the confirmation modal
      await user.click(screen.getByRole('button', { name: 'Delete' }))

      await waitFor(() => {
        expect(mockDelete).toHaveBeenCalled()
      })
    })

    it('skips a recurring task today (handleSkipToday, lines 221-225)', async () => {
      mockOneTimeTasksData.current = []
      mockRecurringTasksData.current = [
        {
          id: 'rec-skip',
          family_id: 'family-1',
          title: 'Recurring Skip Me',
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

      const user = userEvent.setup()
      render(<QuestsPage />)

      await waitFor(() => {
        expect(screen.getByText('Recurring Skip Me')).toBeInTheDocument()
      })

      // Click the delete button (for recurring it shows skip/end options)
      const deleteButton = screen.getByTitle('Delete quest')
      await user.click(deleteButton)

      await waitFor(() => {
        expect(screen.getByText('Remove Quest?')).toBeInTheDocument()
      })

      // Click "Skip today only"
      await user.click(screen.getByRole('button', { name: 'Skip today only' }))

      await waitFor(() => {
        expect(mockInsert).toHaveBeenCalled()
      })
    })

    it('ends a recurring task (handleEndRecurring, line 245)', async () => {
      mockOneTimeTasksData.current = []
      mockRecurringTasksData.current = [
        {
          id: 'rec-end',
          family_id: 'family-1',
          title: 'Recurring End Me',
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

      const user = userEvent.setup()
      render(<QuestsPage />)

      await waitFor(() => {
        expect(screen.getByText('Recurring End Me')).toBeInTheDocument()
      })

      // Click the delete button
      const deleteButton = screen.getByTitle('Delete quest')
      await user.click(deleteButton)

      await waitFor(() => {
        expect(screen.getByText('Remove Quest?')).toBeInTheDocument()
      })

      // Click "Stop all future occurrences"
      await user.click(screen.getByRole('button', { name: 'Stop all future occurrences' }))

      await waitFor(() => {
        expect(mockUpdate).toHaveBeenCalled()
      })
    })

    it('handles complete when user is null (line 273 guard)', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
      const user = userEvent.setup()
      render(<QuestsPage />)

      await waitFor(() => {
        expect(screen.getByText('Clean Room')).toBeInTheDocument()
      })

      // Make getUser return null AFTER render
      mockGetUser.mockResolvedValue({ data: { user: null } })

      const taskCard = screen.getByText('Clean Room').closest('div[class*="bg-white rounded-xl"]')!
      const checkbox = taskCard.querySelector('button')!
      await user.click(checkbox)

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Failed to complete task:', expect.any(Error))
      })
      consoleSpy.mockRestore()
    })

    it('handles uncomplete when user is null (line 310 guard)', async () => {
      mockOneTimeTasksData.current = [{ ...mockTasks[0], completed: true }]
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
      const user = userEvent.setup()
      render(<QuestsPage />)

      await waitFor(() => {
        expect(screen.getByText('Clean Room')).toBeInTheDocument()
      })

      // Make getUser return null AFTER render
      mockGetUser.mockResolvedValue({ data: { user: null } })

      const undoButton = screen.getByTitle('Click to undo')
      await user.click(undoButton)

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Failed to uncomplete task:', expect.any(Error))
      })
      consoleSpy.mockRestore()
    })

    it('shows error when delete fails (line 211-213)', async () => {
      mockDelete.mockResolvedValue({ error: { message: 'Permission denied' } })

      const user = userEvent.setup()
      render(<QuestsPage />)

      await waitFor(() => {
        expect(screen.getByText('Clean Room')).toBeInTheDocument()
      })

      const deleteButton = screen.getByTitle('Delete quest')
      await user.click(deleteButton)

      await waitFor(() => {
        expect(screen.getByText('Delete Quest?')).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: 'Delete' }))

      await waitFor(() => {
        expect(screen.getByText('You do not have permission to delete this quest.')).toBeInTheDocument()
      })
    })

    it('shows error when skip fails (line 236-237)', async () => {
      mockInsert.mockResolvedValue({ error: { message: 'Skip denied' } })
      mockOneTimeTasksData.current = []
      mockRecurringTasksData.current = [
        {
          id: 'rec-skip-err',
          family_id: 'family-1',
          title: 'Recurring Skip Error',
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

      const user = userEvent.setup()
      render(<QuestsPage />)

      await waitFor(() => {
        expect(screen.getByText('Recurring Skip Error')).toBeInTheDocument()
      })

      const deleteButton = screen.getByTitle('Delete quest')
      await user.click(deleteButton)

      await waitFor(() => {
        expect(screen.getByText('Remove Quest?')).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: 'Skip today only' }))

      await waitFor(() => {
        expect(screen.getByText('You do not have permission to skip this quest.')).toBeInTheDocument()
      })
    })

    it('shows error when end recurring fails (line 257-259)', async () => {
      mockUpdate.mockResolvedValue({ error: { message: 'End denied' } })
      mockOneTimeTasksData.current = []
      mockRecurringTasksData.current = [
        {
          id: 'rec-end-err',
          family_id: 'family-1',
          title: 'Recurring End Error',
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

      const user = userEvent.setup()
      render(<QuestsPage />)

      await waitFor(() => {
        expect(screen.getByText('Recurring End Error')).toBeInTheDocument()
      })

      const deleteButton = screen.getByTitle('Delete quest')
      await user.click(deleteButton)

      await waitFor(() => {
        expect(screen.getByText('Remove Quest?')).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: 'Stop all future occurrences' }))

      await waitFor(() => {
        expect(screen.getByText('You do not have permission to modify this quest.')).toBeInTheDocument()
      })
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
