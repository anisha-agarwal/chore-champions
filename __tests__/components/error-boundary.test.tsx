import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'

// Mock client logger — use jest.fn() in factory to avoid TDZ issues
jest.mock('@/lib/observability/client-logger', () => ({
  logClientError: jest.fn(),
}))

import { ObservabilityErrorBoundary } from '@/components/error-boundary'
import { logClientError } from '@/lib/observability/client-logger'

const mockLogClientError = logClientError as jest.Mock

function ThrowingChild({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error('Test crash')
  return <div>Child content</div>
}

// Suppress console.error for expected errors
const originalError = console.error
beforeAll(() => {
  console.error = (...args: unknown[]) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('Test crash') || args[0].includes('Error Boundary'))
    ) {
      return
    }
    originalError(...args)
  }
})
afterAll(() => {
  console.error = originalError
})

describe('ObservabilityErrorBoundary', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders children when no error', () => {
    render(
      <ObservabilityErrorBoundary>
        <ThrowingChild shouldThrow={false} />
      </ObservabilityErrorBoundary>
    )
    expect(screen.getByText('Child content')).toBeInTheDocument()
  })

  it('renders fallback UI when child throws', () => {
    render(
      <ObservabilityErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </ObservabilityErrorBoundary>
    )
    expect(screen.getByText(/Something went wrong/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument()
  })

  it('calls logClientError when error occurs', () => {
    render(
      <ObservabilityErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </ObservabilityErrorBoundary>
    )
    expect(mockLogClientError).toHaveBeenCalledWith(
      expect.objectContaining({
        error_message: 'Test crash',
        error_type: 'boundary',
      })
    )
  })

  it('resets error state when Retry is clicked', () => {
    const { rerender } = render(
      <ObservabilityErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </ObservabilityErrorBoundary>
    )

    expect(screen.getByText(/Something went wrong/)).toBeInTheDocument()

    // Update the child to not throw BEFORE resetting the boundary,
    // so that when Retry clears hasError, the child renders successfully
    rerender(
      <ObservabilityErrorBoundary>
        <ThrowingChild shouldThrow={false} />
      </ObservabilityErrorBoundary>
    )

    fireEvent.click(screen.getByRole('button', { name: /Retry/i }))

    expect(screen.getByText('Child content')).toBeInTheDocument()
  })
})
