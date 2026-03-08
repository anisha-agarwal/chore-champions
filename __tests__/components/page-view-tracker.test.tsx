import { render } from '@testing-library/react'

// Mock client logger — use jest.fn() in factory to avoid TDZ issues
jest.mock('@/lib/observability/client-logger', () => ({
  logClientEvent: jest.fn(),
}))

const mockUsePathname = jest.fn<string | null, []>().mockReturnValue('/quests')
jest.mock('next/navigation', () => ({
  ...jest.requireActual('next/navigation'),
  usePathname: () => mockUsePathname(),
}))

import { PageViewTracker } from '@/components/page-view-tracker'
import { logClientEvent } from '@/lib/observability/client-logger'

const mockLogClientEvent = logClientEvent as jest.Mock

describe('PageViewTracker', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUsePathname.mockReturnValue('/quests')
  })

  it('renders nothing (null)', () => {
    const { container } = render(<PageViewTracker />)
    expect(container.firstChild).toBeNull()
  })

  it('logs page_view event on mount', () => {
    render(<PageViewTracker />)
    expect(mockLogClientEvent).toHaveBeenCalledWith({
      event_type: 'page_view',
      metadata: { path: '/quests' },
    })
  })

  it('does not log the same path twice on re-render', () => {
    const { rerender } = render(<PageViewTracker />)
    rerender(<PageViewTracker />)
    expect(mockLogClientEvent).toHaveBeenCalledTimes(1)
  })

  it('does not log when pathname is null', () => {
    mockUsePathname.mockReturnValue(null)
    render(<PageViewTracker />)
    expect(mockLogClientEvent).not.toHaveBeenCalled()
  })
})
