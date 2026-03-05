import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FreezeSection } from '@/components/streaks/freeze-section'

describe('FreezeSection', () => {
  const defaultProps = {
    available: 3,
    used: 1,
    userPoints: 100,
    onBuy: jest.fn().mockResolvedValue(undefined),
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders freeze section title', () => {
    render(<FreezeSection {...defaultProps} />)

    expect(screen.getByText('Streak Freezes')).toBeInTheDocument()
  })

  it('renders snowflake icon', () => {
    render(<FreezeSection {...defaultProps} />)

    expect(screen.getByText('❄️')).toBeInTheDocument()
  })

  it('shows remaining freeze count', () => {
    render(<FreezeSection {...defaultProps} />)

    expect(screen.getByTestId('freeze-count')).toHaveTextContent('2') // 3 - 1
  })

  it('shows buy button', () => {
    render(<FreezeSection {...defaultProps} />)

    expect(screen.getByRole('button', { name: /Buy Freeze/i })).toBeInTheDocument()
  })

  it('buy button is enabled when user has enough points', () => {
    render(<FreezeSection {...defaultProps} />)

    expect(screen.getByRole('button', { name: /Buy Freeze/i })).not.toBeDisabled()
  })

  it('buy button is disabled when user has < 50 points', () => {
    render(<FreezeSection {...defaultProps} userPoints={30} />)

    expect(screen.getByRole('button', { name: /Buy Freeze/i })).toBeDisabled()
  })

  it('shows points needed message when insufficient', () => {
    render(<FreezeSection {...defaultProps} userPoints={30} />)

    expect(screen.getByText('Need 20 more points')).toBeInTheDocument()
  })

  it('does not show points needed when sufficient', () => {
    render(<FreezeSection {...defaultProps} userPoints={100} />)

    expect(screen.queryByText(/Need.*more points/)).not.toBeInTheDocument()
  })

  it('calls onBuy when buy button clicked', async () => {
    const onBuy = jest.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<FreezeSection {...defaultProps} onBuy={onBuy} />)

    await user.click(screen.getByRole('button', { name: /Buy Freeze/i }))

    await waitFor(() => {
      expect(onBuy).toHaveBeenCalledTimes(1)
    })
  })

  it('shows loading state during purchase', async () => {
    let resolveBuy: () => void
    const onBuy = jest.fn().mockReturnValue(new Promise<void>((resolve) => { resolveBuy = resolve }))
    const user = userEvent.setup()
    render(<FreezeSection {...defaultProps} onBuy={onBuy} />)

    await user.click(screen.getByRole('button', { name: /Buy Freeze/i }))

    // While buying, button should show loading state (from Button component)
    expect(screen.getByText('Saving...')).toBeInTheDocument()

    // Resolve the promise
    resolveBuy!()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Buy Freeze/i })).toBeInTheDocument()
    })
  })

  it('shows 0 remaining when all used', () => {
    render(<FreezeSection {...defaultProps} available={2} used={2} />)

    expect(screen.getByTestId('freeze-count')).toHaveTextContent('0')
  })

  it('shows description text', () => {
    render(<FreezeSection {...defaultProps} />)

    expect(screen.getByText('Protect your streak when you miss a day')).toBeInTheDocument()
  })

  it('shows exact 50 points boundary', () => {
    render(<FreezeSection {...defaultProps} userPoints={50} />)

    expect(screen.getByRole('button', { name: /Buy Freeze/i })).not.toBeDisabled()
    expect(screen.queryByText(/Need.*more points/)).not.toBeInTheDocument()
  })

  it('shows 49 points as insufficient', () => {
    render(<FreezeSection {...defaultProps} userPoints={49} />)

    expect(screen.getByRole('button', { name: /Buy Freeze/i })).toBeDisabled()
    expect(screen.getByText('Need 1 more points')).toBeInTheDocument()
  })

  it('handles zero available and zero used', () => {
    render(<FreezeSection {...defaultProps} available={0} used={0} />)

    expect(screen.getByTestId('freeze-count')).toHaveTextContent('0')
  })
})
