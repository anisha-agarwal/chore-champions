import { render, screen, fireEvent } from '@testing-library/react'
import { ErrorTable } from '@/components/admin/error-table'
import type { AppError } from '@/lib/types'

function makeError(overrides: Partial<AppError> = {}): AppError {
  return {
    id: 'err-1',
    error_message: 'Something failed',
    error_type: 'api',
    error_code: '500',
    route: '/api/test',
    method: 'POST',
    user_id: 'user-123',
    metadata: { route: '/api/test' },
    created_at: new Date().toISOString(),
    ...overrides,
  }
}

describe('ErrorTable', () => {
  const mockPageChange = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('shows "No errors" message when empty', () => {
    render(<ErrorTable errors={[]} total={0} page={1} totalPages={1} onPageChange={mockPageChange} />)
    expect(screen.getByText(/No errors/)).toBeInTheDocument()
  })

  it('renders error rows', () => {
    render(
      <ErrorTable
        errors={[makeError()]}
        total={1}
        page={1}
        totalPages={1}
        onPageChange={mockPageChange}
      />
    )
    expect(screen.getByText('Something failed')).toBeInTheDocument()
    expect(screen.getByText('/api/test')).toBeInTheDocument()
    expect(screen.getByText('api')).toBeInTheDocument()
  })

  it('expands row detail on click', () => {
    render(
      <ErrorTable
        errors={[makeError({ user_id: 'user-abc', error_code: 'E500' })]}
        total={1}
        page={1}
        totalPages={1}
        onPageChange={mockPageChange}
      />
    )
    fireEvent.click(screen.getByText('Something failed'))
    expect(screen.getByText('user-abc')).toBeInTheDocument()
    expect(screen.getByText('E500')).toBeInTheDocument()
  })

  it('collapses row detail on second click', () => {
    render(
      <ErrorTable
        errors={[makeError()]}
        total={1}
        page={1}
        totalPages={1}
        onPageChange={mockPageChange}
      />
    )
    fireEvent.click(screen.getByText('Something failed'))
    fireEvent.click(screen.getByText('Something failed'))
    // User ID detail should be gone
    expect(screen.queryByText('user-123')).not.toBeInTheDocument()
  })

  it('shows pagination when totalPages > 1', () => {
    render(
      <ErrorTable
        errors={[makeError()]}
        total={100}
        page={2}
        totalPages={5}
        onPageChange={mockPageChange}
      />
    )
    expect(screen.getByText(/Page 2 of 5/)).toBeInTheDocument()
  })

  it('calls onPageChange with correct page', () => {
    render(
      <ErrorTable
        errors={[makeError()]}
        total={100}
        page={2}
        totalPages={5}
        onPageChange={mockPageChange}
      />
    )
    fireEvent.click(screen.getByText('→'))
    expect(mockPageChange).toHaveBeenCalledWith(3)

    fireEvent.click(screen.getByText('←'))
    expect(mockPageChange).toHaveBeenCalledWith(1)
  })

  it('shows total errors count', () => {
    render(
      <ErrorTable
        errors={[makeError()]}
        total={42}
        page={1}
        totalPages={1}
        onPageChange={mockPageChange}
      />
    )
    expect(screen.getByText('42 total errors')).toBeInTheDocument()
  })

  it('shows metadata in expanded view when metadata is non-empty', () => {
    render(
      <ErrorTable
        errors={[makeError({ metadata: { route: '/test' } })]}
        total={1}
        page={1}
        totalPages={1}
        onPageChange={mockPageChange}
      />
    )
    fireEvent.click(screen.getByText('Something failed'))
    expect(screen.getByText(/Metadata/)).toBeInTheDocument()
  })

  it('handles unknown error type gracefully', () => {
    render(
      <ErrorTable
        // @ts-expect-error - testing unknown type
        errors={[makeError({ error_type: 'unknown_type' })]}
        total={1}
        page={1}
        totalPages={1}
        onPageChange={mockPageChange}
      />
    )
    expect(screen.getByText('unknown_type')).toBeInTheDocument()
  })
})
