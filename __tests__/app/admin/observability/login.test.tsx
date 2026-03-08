import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import AdminLoginPage from '@/app/admin/observability/login/page'

const mockPush = jest.fn()
const mockRefresh = jest.fn()

jest.mock('next/navigation', () => ({
  ...jest.requireActual('next/navigation'),
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}))

const mockFetch = jest.fn()
global.fetch = mockFetch

describe('AdminLoginPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders password form', () => {
    render(<AdminLoginPage />)
    expect(screen.getByLabelText('Admin Password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Sign In/i })).toBeInTheDocument()
  })

  it('button is disabled when password is empty', () => {
    render(<AdminLoginPage />)
    expect(screen.getByRole('button', { name: /Sign In/i })).toBeDisabled()
  })

  it('enables button when password is entered', () => {
    render(<AdminLoginPage />)
    fireEvent.change(screen.getByLabelText('Admin Password'), { target: { value: 'secret' } })
    expect(screen.getByRole('button', { name: /Sign In/i })).not.toBeDisabled()
  })

  it('submits password and redirects on success', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true })
    render(<AdminLoginPage />)

    fireEvent.change(screen.getByLabelText('Admin Password'), { target: { value: 'correct' } })
    fireEvent.click(screen.getByRole('button', { name: /Sign In/i }))

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/admin/auth', expect.objectContaining({ method: 'POST' }))
      expect(mockPush).toHaveBeenCalledWith('/admin/observability')
    })
  })

  it('shows error toast on 401', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: 'Invalid password' }),
    })
    render(<AdminLoginPage />)

    fireEvent.change(screen.getByLabelText('Admin Password'), { target: { value: 'wrong' } })
    fireEvent.click(screen.getByRole('button', { name: /Sign In/i }))

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled()
      // Password should be cleared after failed login
      expect(screen.getByLabelText('Admin Password')).toHaveValue('')
    })
  })

  it('handles 429 rate limit response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: async () => ({ error: 'Too many attempts' }),
    })
    render(<AdminLoginPage />)

    fireEvent.change(screen.getByLabelText('Admin Password'), { target: { value: 'test' } })
    fireEvent.click(screen.getByRole('button', { name: /Sign In/i }))

    await waitFor(() => expect(mockFetch).toHaveBeenCalled())
  })

  it('handles network error gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'))
    render(<AdminLoginPage />)

    fireEvent.change(screen.getByLabelText('Admin Password'), { target: { value: 'test' } })
    fireEvent.click(screen.getByRole('button', { name: /Sign In/i }))

    await waitFor(() => expect(mockFetch).toHaveBeenCalled())
    // Should not crash
    expect(screen.getByLabelText('Admin Password')).toBeInTheDocument()
  })
})
