'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function JoinPage() {
  const [code, setCode] = useState('')
  const router = useRouter()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (code.trim()) {
      router.push(`/join/${code.trim()}`)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-600 to-blue-500 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Join a Family</h1>
          <p className="text-gray-600 mt-2">Enter the invite code shared with you</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="code" className="block text-sm font-medium text-gray-700 mb-1">
              Invite Code
            </label>
            <input
              id="code"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition text-center text-2xl tracking-widest font-mono text-gray-900"
              placeholder="ABCD1234"
              maxLength={8}
            />
          </div>

          <button
            type="submit"
            disabled={!code.trim()}
            className="w-full bg-purple-600 text-white py-3 rounded-lg font-semibold hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            Continue
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-gray-200 space-y-3">
          <p className="text-center text-gray-600">
            Don&apos;t have a code?{' '}
            <Link href="/signup" className="text-purple-600 font-semibold hover:underline">
              Create a new family
            </Link>
          </p>
          <p className="text-center text-gray-600">
            Already have an account?{' '}
            <Link href="/login" className="text-purple-600 font-semibold hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
