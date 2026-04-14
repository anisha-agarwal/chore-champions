import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PermissionPrompt } from '@/components/notifications/permission-prompt'

describe('PermissionPrompt', () => {
  const onRequest = jest.fn()

  beforeEach(() => jest.clearAllMocks())

  it('renders granted state with success message', () => {
    render(<PermissionPrompt state="granted" onRequestPermission={onRequest} />)
    expect(screen.getByText('Notifications enabled on this device')).toBeInTheDocument()
  })

  it('renders denied state with instructions', () => {
    render(<PermissionPrompt state="denied" onRequestPermission={onRequest} />)
    expect(screen.getByText('Notifications are blocked')).toBeInTheDocument()
    expect(screen.getByText(/enable them in your browser settings/)).toBeInTheDocument()
  })

  it('renders unsupported state', () => {
    render(<PermissionPrompt state="unsupported" onRequestPermission={onRequest} />)
    expect(screen.getByText(/not supported/)).toBeInTheDocument()
  })

  it('renders enable button for default state', () => {
    render(<PermissionPrompt state="default" onRequestPermission={onRequest} />)
    expect(screen.getByRole('button', { name: /enable push notifications/i })).toBeInTheDocument()
  })

  it('calls onRequestPermission when enable button is clicked', async () => {
    render(<PermissionPrompt state="default" onRequestPermission={onRequest} />)
    await userEvent.click(screen.getByRole('button', { name: /enable push notifications/i }))
    expect(onRequest).toHaveBeenCalledTimes(1)
  })

  it('shows spinner when loading', () => {
    render(<PermissionPrompt state="default" onRequestPermission={onRequest} loading />)
    const button = screen.getByRole('button', { name: /enable push notifications/i })
    expect(button).toBeDisabled()
  })
})
