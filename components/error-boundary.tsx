'use client'

import React from 'react'
import { logClientError } from '@/lib/observability/client-logger'

interface Props {
  children: React.ReactNode
}

interface State {
  hasError: boolean
}

function ErrorFallback({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <p className="text-gray-600 mb-4">Something went wrong. Please try again.</p>
      <button
        onClick={onRetry}
        className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
      >
        Retry
      </button>
    </div>
  )
}

export class ObservabilityErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logClientError({
      error_message: error.message,
      error_type: 'boundary',
      route: typeof window !== 'undefined' ? window.location.pathname : 'unknown',
      metadata: {
        componentStack: errorInfo.componentStack?.slice(0, 500),
      },
    })
  }

  handleRetry = () => {
    this.setState({ hasError: false })
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback onRetry={this.handleRetry} />
    }
    return this.props.children
  }
}
