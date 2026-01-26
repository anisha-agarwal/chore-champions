import { render, screen } from '@testing-library/react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

describe('Card', () => {
  it('renders children', () => {
    render(<Card>Card content</Card>)
    expect(screen.getByText('Card content')).toBeInTheDocument()
  })

  it('applies custom className', () => {
    render(<Card className="custom-class" data-testid="card">Content</Card>)
    expect(screen.getByTestId('card')).toHaveClass('custom-class')
  })
})

describe('CardHeader', () => {
  it('renders children', () => {
    render(<CardHeader>Header content</CardHeader>)
    expect(screen.getByText('Header content')).toBeInTheDocument()
  })
})

describe('CardTitle', () => {
  it('renders as h3', () => {
    render(<CardTitle>Title</CardTitle>)
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Title')
  })
})

describe('CardContent', () => {
  it('renders children', () => {
    render(<CardContent>Content here</CardContent>)
    expect(screen.getByText('Content here')).toBeInTheDocument()
  })
})

describe('Card composition', () => {
  it('renders full card structure', () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>My Card</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Card body text</p>
        </CardContent>
      </Card>
    )

    expect(screen.getByRole('heading', { name: 'My Card' })).toBeInTheDocument()
    expect(screen.getByText('Card body text')).toBeInTheDocument()
  })
})
