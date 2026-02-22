import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import JoinFamilyPage from '@/app/(auth)/join/[code]/page'

// Mock next/navigation
const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: jest.fn(),
  }),
  useParams: () => ({
    code: 'TESTCODE',
  }),
}))

// Mock Supabase client
const mockSignUp = jest.fn()
const mockUpdate = jest.fn()
const mockRpc = jest.fn()

jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signUp: mockSignUp,
    },
    from: () => ({
      update: mockUpdate.mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
    }),
    rpc: mockRpc,
  }),
}))

describe('Join Family Page', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Set up valid invite code response
    mockRpc.mockReturnValue({
      single: () => Promise.resolve({
        data: { id: 'family-123', name: 'Test Family' },
        error: null,
      }),
    })
  })

  it('renders join form without role selector after loading', async () => {
    render(<JoinFamilyPage />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /join family/i })).toBeInTheDocument()
    })

    expect(screen.getByLabelText(/display name/i)).toBeInTheDocument()
    expect(screen.queryByText('I am a...')).not.toBeInTheDocument()
    expect(screen.queryByText('Parent')).not.toBeInTheDocument()
    expect(screen.queryByText('Kid')).not.toBeInTheDocument()
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
  })

  it('shows loading state initially', () => {
    render(<JoinFamilyPage />)

    expect(screen.getByText(/checking invite code/i)).toBeInTheDocument()
  })

  it('shows error for invalid invite code', async () => {
    mockRpc.mockReturnValue({
      single: () => Promise.resolve({
        data: null,
        error: { message: 'Not found' },
      }),
    })

    render(<JoinFamilyPage />)

    await waitFor(() => {
      expect(screen.getByText(/invalid invite/i)).toBeInTheDocument()
    })
  })

  it('calls signUp with display_name only (no role)', async () => {
    mockSignUp.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    })
    mockUpdate.mockReturnValue({
      eq: jest.fn().mockResolvedValue({ error: null }),
    })

    render(<JoinFamilyPage />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /join family/i })).toBeInTheDocument()
    })

    await userEvent.type(screen.getByLabelText(/display name/i), 'Test Kid')
    await userEvent.type(screen.getByLabelText(/email/i), 'kid@example.com')
    await userEvent.type(screen.getByLabelText(/password/i), 'password123')
    await userEvent.click(screen.getByRole('button', { name: /join test family/i }))

    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalledWith({
        email: 'kid@example.com',
        password: 'password123',
        options: {
          data: {
            display_name: 'Test Kid',
          },
        },
      })
    })
  })
})
