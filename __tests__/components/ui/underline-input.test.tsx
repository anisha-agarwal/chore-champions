import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UnderlineInput } from '@/components/ui/underline-input'

describe('UnderlineInput', () => {
  it('renders with label', () => {
    render(<UnderlineInput label="Email" value="" onChange={() => {}} />)

    expect(screen.getByText('Email')).toBeInTheDocument()
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('shows required indicator when required', () => {
    render(<UnderlineInput label="Email" value="" onChange={() => {}} required />)

    expect(screen.getByText('*')).toBeInTheDocument()
  })

  it('does not show required indicator when not required', () => {
    render(<UnderlineInput label="Email" value="" onChange={() => {}} />)

    expect(screen.queryByText('*')).not.toBeInTheDocument()
  })

  it('displays helper text when provided', () => {
    render(
      <UnderlineInput
        label="Nickname"
        value=""
        onChange={() => {}}
        helperText="A fun name to display"
      />
    )

    expect(screen.getByText('A fun name to display')).toBeInTheDocument()
  })

  it('displays placeholder when provided', () => {
    render(
      <UnderlineInput
        label="Name"
        value=""
        onChange={() => {}}
        placeholder="Enter your name"
      />
    )

    expect(screen.getByPlaceholderText('Enter your name')).toBeInTheDocument()
  })

  it('calls onChange when typing', async () => {
    const handleChange = jest.fn()
    const user = userEvent.setup()

    render(<UnderlineInput label="Name" value="" onChange={handleChange} />)

    const input = screen.getByRole('textbox')
    await user.type(input, 'John')

    expect(handleChange).toHaveBeenCalled()
  })

  it('generates id from label', () => {
    render(<UnderlineInput label="Display Name" value="" onChange={() => {}} />)

    const input = screen.getByRole('textbox')
    expect(input).toHaveAttribute('id', 'display-name')
  })

  it('uses provided id over generated one', () => {
    render(<UnderlineInput label="Display Name" id="custom-id" value="" onChange={() => {}} />)

    const input = screen.getByRole('textbox')
    expect(input).toHaveAttribute('id', 'custom-id')
  })

  it('displays current value', () => {
    render(<UnderlineInput label="Name" value="John Doe" onChange={() => {}} />)

    expect(screen.getByDisplayValue('John Doe')).toBeInTheDocument()
  })

  it('expands underline on focus', async () => {
    const user = userEvent.setup()
    const { container } = render(<UnderlineInput label="Name" value="" onChange={() => {}} />)

    const input = screen.getByRole('textbox')
    await user.click(input)

    // The animated underline div should have w-full class when focused
    const underline = container.querySelector('.bg-purple-600')
    expect(underline).toHaveClass('w-full')
  })

  it('collapses underline on blur', async () => {
    const user = userEvent.setup()
    const { container } = render(<UnderlineInput label="Name" value="" onChange={() => {}} />)

    const input = screen.getByRole('textbox')
    await user.click(input)
    await user.tab() // blur

    const underline = container.querySelector('.bg-purple-600')
    expect(underline).toHaveClass('w-0')
  })

  it('calls provided onFocus handler', async () => {
    const handleFocus = jest.fn()
    const user = userEvent.setup()
    render(<UnderlineInput label="Name" value="" onChange={() => {}} onFocus={handleFocus} />)

    const input = screen.getByRole('textbox')
    await user.click(input)

    expect(handleFocus).toHaveBeenCalled()
  })

  it('calls provided onBlur handler', async () => {
    const handleBlur = jest.fn()
    const user = userEvent.setup()
    render(<UnderlineInput label="Name" value="" onChange={() => {}} onBlur={handleBlur} />)

    const input = screen.getByRole('textbox')
    await user.click(input)
    await user.tab()

    expect(handleBlur).toHaveBeenCalled()
  })

  it('passes type prop through', () => {
    render(<UnderlineInput label="Password" value="" onChange={() => {}} type="password" />)

    const input = screen.getByLabelText('Password')
    expect(input).toHaveAttribute('type', 'password')
  })
})
