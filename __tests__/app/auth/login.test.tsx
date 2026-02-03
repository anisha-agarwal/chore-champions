import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LoginPage from '@/app/(auth)/login/page'

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    refresh: jest.fn(),
  }),
}))

// Mock Supabase client
const mockSignInWithPassword = jest.fn()
const mockSignInWithOAuth = jest.fn()

jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signInWithPassword: mockSignInWithPassword,
      signInWithOAuth: mockSignInWithOAuth,
    },
  }),
}))

describe('Login Page', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders login form', () => {
    render(<LoginPage />)

    expect(screen.getByRole('heading', { name: /chore champions/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('renders Google login button', () => {
    render(<LoginPage />)

    expect(screen.getByText(/or continue with/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /google/i })).toBeInTheDocument()
  })

  it('calls signInWithOAuth when Google button is clicked', async () => {
    mockSignInWithOAuth.mockResolvedValue({ error: null })
    render(<LoginPage />)

    const googleButton = screen.getByRole('button', { name: /google/i })
    await userEvent.click(googleButton)

    expect(mockSignInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: {
        redirectTo: expect.stringContaining('/auth/callback'),
      },
    })
  })

  it('shows error when Google login fails', async () => {
    mockSignInWithOAuth.mockResolvedValue({
      error: { message: 'Google login failed' }
    })
    render(<LoginPage />)

    const googleButton = screen.getByRole('button', { name: /google/i })
    await userEvent.click(googleButton)

    expect(await screen.findByText(/google login failed/i)).toBeInTheDocument()
  })

  it('renders Facebook login button', () => {
    render(<LoginPage />)

    expect(screen.getByRole('button', { name: /facebook/i })).toBeInTheDocument()
  })

  it('calls signInWithOAuth when Facebook button is clicked', async () => {
    mockSignInWithOAuth.mockResolvedValue({ error: null })
    render(<LoginPage />)

    const facebookButton = screen.getByRole('button', { name: /facebook/i })
    await userEvent.click(facebookButton)

    expect(mockSignInWithOAuth).toHaveBeenCalledWith({
      provider: 'facebook',
      options: {
        redirectTo: expect.stringContaining('/auth/callback'),
      },
    })
  })

  it('shows error when Facebook login fails', async () => {
    mockSignInWithOAuth.mockResolvedValue({
      error: { message: 'Facebook login failed' }
    })
    render(<LoginPage />)

    const facebookButton = screen.getByRole('button', { name: /facebook/i })
    await userEvent.click(facebookButton)

    expect(await screen.findByText(/facebook login failed/i)).toBeInTheDocument()
  })

  it('calls signInWithPassword on form submit', async () => {
    mockSignInWithPassword.mockResolvedValue({ error: null })
    render(<LoginPage />)

    await userEvent.type(screen.getByLabelText(/email/i), 'test@example.com')
    await userEvent.type(screen.getByLabelText(/password/i), 'password123')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))

    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password123',
    })
  })
})
