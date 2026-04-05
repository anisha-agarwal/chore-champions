import { render, screen } from '@testing-library/react'
import { TypingIndicator } from '@/components/chat/typing-indicator'

describe('TypingIndicator', () => {
  it('renders with accessible label', () => {
    render(<TypingIndicator />)
    expect(screen.getByLabelText('Assistant is typing')).toBeInTheDocument()
  })

  it('renders three animated dots', () => {
    const { container } = render(<TypingIndicator />)
    const dots = container.querySelectorAll('.animate-bounce')
    expect(dots).toHaveLength(3)
  })
})
