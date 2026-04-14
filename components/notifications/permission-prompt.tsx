'use client'

interface PermissionPromptProps {
  state: NotificationPermission | 'unsupported'
  onRequestPermission: () => void
  loading?: boolean
}

export function PermissionPrompt({ state, onRequestPermission, loading }: PermissionPromptProps) {
  if (state === 'granted') {
    return (
      <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
        <span>Notifications enabled on this device</span>
      </div>
    )
  }

  if (state === 'denied') {
    return (
      <div className="text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
        <p className="font-medium">Notifications are blocked</p>
        <p className="mt-1 text-amber-600">
          To receive notifications, enable them in your browser settings for this site.
        </p>
      </div>
    )
  }

  if (state === 'unsupported') {
    return (
      <div className="text-sm text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
        Push notifications are not supported in this browser.
      </div>
    )
  }

  return (
    <button
      onClick={onRequestPermission}
      disabled={loading}
      className="w-full flex items-center justify-center gap-2 bg-purple-600 text-white rounded-lg px-4 py-3 text-sm font-medium hover:bg-purple-700 disabled:opacity-50 transition"
    >
      {loading ? (
        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
        </svg>
      )}
      Enable push notifications
    </button>
  )
}
