import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SignupPage from '@/app/(auth)/signup/page'

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    refresh: jest.fn(),
  }),
}))

// Mock Supabase client
const mockSignUp = jest.fn()
const mockSignInWithOAuth = jest.fn()

jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signUp: mockSignUp,
      signInWithOAuth: mockSignInWithOAuth,
    },
  }),
}))

describe('Signup Page', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders signup form with role selector', () => {
    render(<SignupPage />)

    expect(screen.getByRole('heading', { name: /chore champions/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/display name/i)).toBeInTheDocument()
    expect(screen.getByText('I am a...')).toBeInTheDocument()
    expect(screen.getByText('Parent')).toBeInTheDocument()
    expect(screen.getByText('Kid')).toBeInTheDocument()
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument()
  })

  it('renders Google signup button', () => {
    render(<SignupPage />)

    expect(screen.getByText(/or continue with/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /google/i })).toBeInTheDocument()
  })

  it('calls signInWithOAuth when Google button is clicked', async () => {
    mockSignInWithOAuth.mockResolvedValue({ error: null })
    render(<SignupPage />)

    const googleButton = screen.getByRole('button', { name: /google/i })
    await userEvent.click(googleButton)

    expect(mockSignInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: {
        redirectTo: expect.stringContaining('/auth/callback'),
      },
    })
  })

  it('shows error when Google signup fails', async () => {
    mockSignInWithOAuth.mockResolvedValue({
      error: { message: 'Google signup failed' }
    })
    render(<SignupPage />)

    const googleButton = screen.getByRole('button', { name: /google/i })
    await userEvent.click(googleButton)

    expect(await screen.findByText(/google signup failed/i)).toBeInTheDocument()
  })

  it('renders Facebook signup button', () => {
    render(<SignupPage />)

    expect(screen.getByRole('button', { name: /facebook/i })).toBeInTheDocument()
  })

  it('calls signInWithOAuth when Facebook button is clicked', async () => {
    mockSignInWithOAuth.mockResolvedValue({ error: null })
    render(<SignupPage />)

    const facebookButton = screen.getByRole('button', { name: /facebook/i })
    await userEvent.click(facebookButton)

    expect(mockSignInWithOAuth).toHaveBeenCalledWith({
      provider: 'facebook',
      options: {
        redirectTo: expect.stringContaining('/auth/callback'),
      },
    })
  })

  it('shows error when Facebook signup fails', async () => {
    mockSignInWithOAuth.mockResolvedValue({
      error: { message: 'Facebook signup failed' }
    })
    render(<SignupPage />)

    const facebookButton = screen.getByRole('button', { name: /facebook/i })
    await userEvent.click(facebookButton)

    expect(await screen.findByText(/facebook signup failed/i)).toBeInTheDocument()
  })

  it('calls signUp with default child role on form submit', async () => {
    mockSignUp.mockResolvedValue({ error: null })
    render(<SignupPage />)

    await userEvent.type(screen.getByLabelText(/display name/i), 'Test User')
    await userEvent.type(screen.getByLabelText(/email/i), 'test@example.com')
    await userEvent.type(screen.getByLabelText(/password/i), 'password123')
    await userEvent.click(screen.getByRole('button', { name: /create account/i }))

    expect(mockSignUp).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password123',
      options: {
        data: {
          display_name: 'Test User',
          role: 'child',
        },
      },
    })
  })

  it('calls signUp with parent role when selected', async () => {
    mockSignUp.mockResolvedValue({ error: null })
    render(<SignupPage />)

    await userEvent.type(screen.getByLabelText(/display name/i), 'Test Parent')
    await userEvent.click(screen.getByText('Parent'))
    await userEvent.type(screen.getByLabelText(/email/i), 'parent@example.com')
    await userEvent.type(screen.getByLabelText(/password/i), 'password123')
    await userEvent.click(screen.getByRole('button', { name: /create account/i }))

    expect(mockSignUp).toHaveBeenCalledWith({
      email: 'parent@example.com',
      password: 'password123',
      options: {
        data: {
          display_name: 'Test Parent',
          role: 'parent',
        },
      },
    })
  })
})
