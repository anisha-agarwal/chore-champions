import { render, screen } from '@testing-library/react'
import { AnalyticsSkeleton } from '@/components/analytics/analytics-skeleton'

describe('AnalyticsSkeleton', () => {
  it('has aria-busy="true"', () => {
    render(<AnalyticsSkeleton />)
    expect(screen.getByLabelText('Loading analytics')).toHaveAttribute('aria-busy', 'true')
  })

  it('has aria-label for accessibility', () => {
    render(<AnalyticsSkeleton />)
    expect(screen.getByLabelText('Loading analytics')).toBeInTheDocument()
  })

  it('renders pulse-animated skeleton elements', () => {
    const { container } = render(<AnalyticsSkeleton />)
    const pulseElements = container.querySelectorAll('.animate-pulse')
    // 2 summary cards + 1 chart + 1 another chart + 1 heatmap = 5
    expect(pulseElements).toHaveLength(5)
  })

  it('renders two summary card skeletons in a grid', () => {
    const { container } = render(<AnalyticsSkeleton />)
    const grid = container.querySelector('.grid')
    expect(grid).toBeInTheDocument()
    expect(grid?.children).toHaveLength(2)
  })

  it('renders chart placeholder skeletons', () => {
    const { container } = render(<AnalyticsSkeleton />)
    // h-48 chart placeholder and h-40 another chart and h-32 heatmap
    expect(container.querySelector('.h-48')).toBeInTheDocument()
    expect(container.querySelector('.h-40')).toBeInTheDocument()
    expect(container.querySelector('.h-32')).toBeInTheDocument()
  })
})
