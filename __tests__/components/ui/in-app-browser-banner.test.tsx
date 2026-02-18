import { render, screen } from '@testing-library/react'
import { InAppBrowserBanner } from '@/components/ui/in-app-browser-banner'

describe('InAppBrowserBanner', () => {
  const originalNavigator = navigator.userAgent

  function setUserAgent(ua: string) {
    Object.defineProperty(navigator, 'userAgent', {
      value: ua,
      writable: true,
      configurable: true,
    })
  }

  afterEach(() => {
    setUserAgent(originalNavigator)
  })

  it('shows banner in Facebook in-app browser', () => {
    setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) FBAN/FBIOS')
    render(<InAppBrowserBanner />)

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText(/open in your browser/i)).toBeInTheDocument()
    expect(screen.getByText(/google and facebook sign-in/i)).toBeInTheDocument()
  })

  it('shows banner in WhatsApp in-app browser', () => {
    setUserAgent('Mozilla/5.0 (Linux; Android 13) WhatsApp/2.23')
    render(<InAppBrowserBanner />)

    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('shows banner in Instagram in-app browser', () => {
    setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) Instagram 275.0')
    render(<InAppBrowserBanner />)

    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('does not show banner in regular browser', () => {
    setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36')
    render(<InAppBrowserBanner />)

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows banner in Twitter in-app browser', () => {
    setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) Twitter for iPhone')
    render(<InAppBrowserBanner />)

    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('shows banner in LinkedIn in-app browser', () => {
    setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) LinkedInApp')
    render(<InAppBrowserBanner />)

    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('shows banner in Line in-app browser', () => {
    setUserAgent('Mozilla/5.0 (Linux; Android 13) Line/12.0')
    render(<InAppBrowserBanner />)

    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('does not show banner in Safari', () => {
    setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/16.0 Safari/605.1.15')
    render(<InAppBrowserBanner />)

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('getServerSnapshot returns false when called by useSyncExternalStore (SSR path, line 16)', () => {
    // Mock useSyncExternalStore to call the getServerSnapshot (3rd argument)
    // and verify it returns false
    const React = jest.requireActual('react') as typeof import('react')
    let capturedServerSnapshot: (() => boolean) | undefined

    jest.spyOn(React, 'useSyncExternalStore').mockImplementationOnce(
      (_subscribe: () => () => void, getSnapshot: () => boolean, getServerSnapshot?: () => boolean) => {
        capturedServerSnapshot = getServerSnapshot
        // Still use the client snapshot for rendering
        return getSnapshot()
      }
    )

    setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36')
    render(<InAppBrowserBanner />)

    // Verify getServerSnapshot was captured and returns false
    expect(capturedServerSnapshot).toBeDefined()
    expect(capturedServerSnapshot!()).toBe(false)

    jest.restoreAllMocks()
  })
})
