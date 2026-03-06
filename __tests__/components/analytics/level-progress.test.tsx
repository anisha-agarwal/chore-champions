import { render, screen } from '@testing-library/react'
import { LevelProgress } from '@/components/analytics/level-progress'

describe('LevelProgress', () => {
  it('renders SVG ring with aria-hidden', () => {
    const { container } = render(<LevelProgress points={0} />)
    const svg = container.querySelector('svg')
    expect(svg).toHaveAttribute('aria-hidden', 'true')
  })

  it('renders two circle elements (background + progress arc)', () => {
    const { container } = render(<LevelProgress points={150} />)
    const circles = container.querySelectorAll('circle')
    expect(circles).toHaveLength(2)
  })

  it('shows level number in center', () => {
    render(<LevelProgress points={0} />)
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('Lvl')).toBeInTheDocument()
  })

  it('shows level name and points', () => {
    render(<LevelProgress points={150} />)
    expect(screen.getByText('Explorer')).toBeInTheDocument()
    expect(screen.getByText('150 points')).toBeInTheDocument()
  })

  it('displays points to next level', () => {
    // Explorer at 150: next is Champion at 300, so 150 to go
    render(<LevelProgress points={150} />)
    expect(screen.getByText('150 to Champion')).toBeInTheDocument()
  })

  it('shows max level message for Legend', () => {
    render(<LevelProgress points={1500} />)
    expect(screen.getByText('Legend')).toBeInTheDocument()
    expect(screen.getByText('Max level reached!')).toBeInTheDocument()
    expect(screen.queryByText(/to /)).not.toBeInTheDocument()
  })

  it('has progressbar role with correct aria attributes', () => {
    render(<LevelProgress points={200} />)
    const progressbar = screen.getByRole('progressbar')
    expect(progressbar).toHaveAttribute('aria-valuenow', '50')
    expect(progressbar).toHaveAttribute('aria-valuemin', '0')
    expect(progressbar).toHaveAttribute('aria-valuemax', '100')
  })

  it('has descriptive aria-label on progressbar', () => {
    render(<LevelProgress points={200} />)
    const progressbar = screen.getByRole('progressbar')
    expect(progressbar).toHaveAttribute(
      'aria-label',
      'Level 2 Explorer: 50% progress toward Champion'
    )
  })

  it('aria-label omits next level for Legend', () => {
    render(<LevelProgress points={2000} />)
    const progressbar = screen.getByRole('progressbar')
    expect(progressbar.getAttribute('aria-label')).toContain('Level 5 Legend: 100% progress')
    expect(progressbar.getAttribute('aria-label')).not.toContain('toward')
  })

  it('renders level 1 Rookie at 0 points', () => {
    render(<LevelProgress points={0} />)
    expect(screen.getByText('Rookie')).toBeInTheDocument()
    const progressbar = screen.getByRole('progressbar')
    expect(progressbar).toHaveAttribute('aria-valuenow', '0')
  })

  it('formats large point numbers with locale string', () => {
    render(<LevelProgress points={1500} />)
    // 1500 formatted as "1,500"
    expect(screen.getByText('1,500 points')).toBeInTheDocument()
  })

  it('calculates correct strokeDashoffset for progress', () => {
    const { container } = render(<LevelProgress points={200} />)
    const circles = container.querySelectorAll('circle')
    // Progress arc is the second circle
    const progressCircle = circles[1]
    const circumference = 2 * Math.PI * 40
    // Explorer at 200: progress = (200-100)/(300-100) = 0.5
    const expectedOffset = circumference * (1 - 0.5)
    expect(progressCircle.getAttribute('stroke-dashoffset')).toBe(String(expectedOffset))
  })
})
