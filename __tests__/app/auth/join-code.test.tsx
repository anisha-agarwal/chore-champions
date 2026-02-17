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
  useParams: () => ({ code: 'TESTCODE' }),
}))

// Mock Supabase client
const mockRpc = jest.fn()
const mockSignUp = jest.fn()
const mockUpdate = jest.fn()

jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signUp: mockSignUp,
    },
    rpc: (...args: unknown[]) => ({
      single: () => mockRpc(...args),
    }),
    from: () => ({
      update: (...args: unknown[]) => ({
        eq: (...eqArgs: unknown[]) => mockUpdate(...args, ...eqArgs),
      }),
    }),
  }),
}))

describe('Join Family Page (with code)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRpc.mockResolvedValue({ data: { id: 'family-1', name: 'The Smiths' }, error: null })
    mockSignUp.mockResolvedValue({ data: { user: { id: 'new-user' } }, error: null })
    mockUpdate.mockResolvedValue({ error: null })
  })

  it('shows checking state initially', () => {
    mockRpc.mockReturnValue(new Promise(() => {}))
    render(<JoinFamilyPage />)
    expect(screen.getByText('Checking invite code...')).toBeInTheDocument()
  })

  it('renders join form when invite code is valid', async () => {
    render(<JoinFamilyPage />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Join Family' })).toBeInTheDocument()
    })

    expect(screen.getByText(/invited to join/i)).toBeInTheDocument()
    expect(screen.getByLabelText('Display Name')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
  })

  it('shows invalid invite when code is bad', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'Not found' } })

    render(<JoinFamilyPage />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Invalid Invite' })).toBeInTheDocument()
    })
    expect(screen.getByText(/invalid or expired invite code/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /create new account/i })).toHaveAttribute('href', '/signup')
  })

  it('submits the form and navigates to quests', async () => {
    render(<JoinFamilyPage />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Join Family' })).toBeInTheDocument()
    })

    await userEvent.type(screen.getByLabelText('Display Name'), 'New User')
    await userEvent.type(screen.getByLabelText('Email'), 'new@example.com')
    await userEvent.type(screen.getByLabelText('Password'), 'password123')

    await userEvent.click(screen.getByRole('button', { name: /join the smiths/i }))

    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalled()
      expect(mockPush).toHaveBeenCalledWith('/quests')
    })
  })

  it('shows error when signUp fails', async () => {
    mockSignUp.mockResolvedValue({ data: { user: null }, error: { message: 'Email already taken' } })

    render(<JoinFamilyPage />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Join Family' })).toBeInTheDocument()
    })

    await userEvent.type(screen.getByLabelText('Display Name'), 'New User')
    await userEvent.type(screen.getByLabelText('Email'), 'taken@example.com')
    await userEvent.type(screen.getByLabelText('Password'), 'password123')

    await userEvent.click(screen.getByRole('button', { name: /join the smiths/i }))

    await waitFor(() => {
      expect(screen.getByText('Email already taken')).toBeInTheDocument()
    })
  })

  it('shows error when profile update fails', async () => {
    mockUpdate.mockResolvedValue({ error: { message: 'Profile update failed' } })

    render(<JoinFamilyPage />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Join Family' })).toBeInTheDocument()
    })

    await userEvent.type(screen.getByLabelText('Display Name'), 'New User')
    await userEvent.type(screen.getByLabelText('Email'), 'new@example.com')
    await userEvent.type(screen.getByLabelText('Password'), 'password123')

    await userEvent.click(screen.getByRole('button', { name: /join the smiths/i }))

    await waitFor(() => {
      expect(screen.getByText('Failed to join family. Please try again.')).toBeInTheDocument()
    })
  })

  it('renders sign-in link', async () => {
    render(<JoinFamilyPage />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Join Family' })).toBeInTheDocument()
    })

    expect(screen.getByRole('link', { name: /sign in/i })).toHaveAttribute('href', '/login')
  })

  it('shows Joining... while loading', async () => {
    mockSignUp.mockReturnValue(new Promise(() => {}))

    render(<JoinFamilyPage />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Join Family' })).toBeInTheDocument()
    })

    await userEvent.type(screen.getByLabelText('Display Name'), 'New User')
    await userEvent.type(screen.getByLabelText('Email'), 'new@example.com')
    await userEvent.type(screen.getByLabelText('Password'), 'password123')

    await userEvent.click(screen.getByRole('button', { name: /join the smiths/i }))

    await waitFor(() => {
      expect(screen.getByText('Joining...')).toBeInTheDocument()
    })
  })
})
