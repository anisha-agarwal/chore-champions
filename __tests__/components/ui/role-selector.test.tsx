import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RoleSelector } from '@/components/ui/role-selector'

describe('RoleSelector', () => {
  it('renders both role options', () => {
    render(<RoleSelector selected="child" onChange={jest.fn()} />)

    expect(screen.getByText('Parent')).toBeInTheDocument()
    expect(screen.getByText('Kid')).toBeInTheDocument()
  })

  it('highlights selected option', () => {
    render(<RoleSelector selected="parent" onChange={jest.fn()} />)

    const parentButton = screen.getByText('Parent')
    expect(parentButton).toHaveClass('bg-purple-600')
  })

  it('does not highlight unselected option', () => {
    render(<RoleSelector selected="parent" onChange={jest.fn()} />)

    const kidButton = screen.getByText('Kid')
    expect(kidButton).not.toHaveClass('bg-purple-600')
    expect(kidButton).toHaveClass('bg-white')
  })

  it('calls onChange when option clicked', async () => {
    const handleChange = jest.fn()
    render(<RoleSelector selected="child" onChange={handleChange} />)

    await userEvent.click(screen.getByText('Parent'))

    expect(handleChange).toHaveBeenCalledWith('parent')
  })

  it('calls onChange when switching from parent to child', async () => {
    const handleChange = jest.fn()
    render(<RoleSelector selected="parent" onChange={handleChange} />)

    await userEvent.click(screen.getByText('Kid'))

    expect(handleChange).toHaveBeenCalledWith('child')
  })

  it('disables buttons when disabled prop is true', () => {
    render(<RoleSelector selected="child" onChange={jest.fn()} disabled />)

    const parentButton = screen.getByText('Parent')
    const kidButton = screen.getByText('Kid')

    expect(parentButton).toBeDisabled()
    expect(kidButton).toBeDisabled()
  })

  it('does not call onChange when disabled and clicked', async () => {
    const handleChange = jest.fn()
    render(<RoleSelector selected="child" onChange={handleChange} disabled />)

    await userEvent.click(screen.getByText('Parent'))

    expect(handleChange).not.toHaveBeenCalled()
  })

  it('applies disabled styling when disabled', () => {
    render(<RoleSelector selected="child" onChange={jest.fn()} disabled />)

    const parentButton = screen.getByText('Parent')
    expect(parentButton).toHaveClass('opacity-50', 'cursor-not-allowed')
  })

  it('renders smaller buttons when size is sm', () => {
    render(<RoleSelector selected="child" onChange={jest.fn()} size="sm" />)

    const parentButton = screen.getByText('Parent')
    expect(parentButton).toHaveClass('px-6', 'py-2', 'text-sm')
  })

  it('renders default size buttons by default', () => {
    render(<RoleSelector selected="child" onChange={jest.fn()} />)

    const parentButton = screen.getByText('Parent')
    expect(parentButton).toHaveClass('px-6', 'py-2', 'text-sm', 'flex-1')
  })
})
