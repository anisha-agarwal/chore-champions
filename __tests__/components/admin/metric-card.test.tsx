import { render, screen } from '@testing-library/react'
import { MetricCard } from '@/components/admin/metric-card'

describe('MetricCard', () => {
  it('renders label and value', () => {
    render(<MetricCard label="Errors" value={42} />)
    expect(screen.getByText('Errors')).toBeInTheDocument()
    expect(screen.getByText('42')).toBeInTheDocument()
  })

  it('renders trend with label', () => {
    render(<MetricCard label="Count" value={10} trend="up" trendLabel="vs prev period" />)
    expect(screen.getByText(/vs prev period/)).toBeInTheDocument()
    expect(screen.getByText(/↑/)).toBeInTheDocument()
  })

  it('renders down trend', () => {
    render(<MetricCard label="Count" value={5} trend="down" trendLabel="improving" />)
    expect(screen.getByText(/↓/)).toBeInTheDocument()
  })

  it('renders neutral trend', () => {
    render(<MetricCard label="Count" value={5} trend="neutral" trendLabel="unchanged" />)
    expect(screen.getByText(/→/)).toBeInTheDocument()
  })

  it('renders with red highlight', () => {
    const { container } = render(<MetricCard label="Errors" value={5} highlight="red" />)
    expect(container.querySelector('.text-red-400')).toBeInTheDocument()
  })

  it('renders with green highlight', () => {
    const { container } = render(<MetricCard label="OK" value={0} highlight="green" />)
    expect(container.querySelector('.text-green-400')).toBeInTheDocument()
  })

  it('renders with yellow highlight', () => {
    const { container } = render(<MetricCard label="Warn" value={500} highlight="yellow" />)
    expect(container.querySelector('.text-yellow-400')).toBeInTheDocument()
  })

  it('renders string values', () => {
    render(<MetricCard label="Latency" value="150ms" />)
    expect(screen.getByText('150ms')).toBeInTheDocument()
  })
})
