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
})
