import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import JoinPage from '@/app/(auth)/join/page'

// Mock next/navigation
const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}))

describe('Join Landing Page', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders heading', () => {
    render(<JoinPage />)
    expect(screen.getByRole('heading', { name: /join a family/i })).toBeInTheDocument()
  })

  it('renders invite code input', () => {
    render(<JoinPage />)
    expect(screen.getByLabelText(/invite code/i)).toBeInTheDocument()
  })

  it('renders Continue button', () => {
    render(<JoinPage />)
    expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument()
  })

  it('Continue button is disabled when input is empty', () => {
    render(<JoinPage />)
    expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled()
  })

  it('Continue button is enabled when input has value', async () => {
    render(<JoinPage />)

    await userEvent.type(screen.getByLabelText(/invite code/i), 'ABC123')
    expect(screen.getByRole('button', { name: /continue/i })).not.toBeDisabled()
  })

  it('converts input to uppercase', async () => {
    render(<JoinPage />)

    const input = screen.getByLabelText(/invite code/i)
    await userEvent.type(input, 'abcd1234')
    expect(input).toHaveValue('ABCD1234')
  })

  it('navigates to /join/{code} on submit', async () => {
    render(<JoinPage />)

    await userEvent.type(screen.getByLabelText(/invite code/i), 'testcode')
    await userEvent.click(screen.getByRole('button', { name: /continue/i }))

    expect(mockPush).toHaveBeenCalledWith('/join/TESTCODE')
  })

  it('trims whitespace from code before navigation', async () => {
    render(<JoinPage />)

    const input = screen.getByLabelText(/invite code/i)
    await userEvent.type(input, ' ABC ')
    await userEvent.click(screen.getByRole('button', { name: /continue/i }))

    expect(mockPush).toHaveBeenCalledWith('/join/ABC')
  })

  it('renders link to create a new family', () => {
    render(<JoinPage />)
    const link = screen.getByRole('link', { name: /create a new family/i })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', '/signup')
  })

  it('renders link to sign in', () => {
    render(<JoinPage />)
    const link = screen.getByRole('link', { name: /sign in/i })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', '/login')
  })
})
