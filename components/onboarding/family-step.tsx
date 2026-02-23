'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'

type FamilyMode = 'choose' | 'join' | 'create'

interface FamilyStepProps {
  onComplete: (familyId: string) => void
}

export function FamilyStep({ onComplete }: FamilyStepProps) {
  const [mode, setMode] = useState<FamilyMode>('choose')
  const [inviteCode, setInviteCode] = useState('')
  const [familyName, setFamilyName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    if (!inviteCode.trim()) return

    setLoading(true)
    setError(null)

    const { data, error: rpcError } = await supabase
      .rpc('get_family_by_invite_code', { code: inviteCode.trim() })
      .single<{ id: string; name: string }>()

    if (rpcError || !data) {
      setError('Invalid or expired invite code. Please check and try again.')
      setLoading(false)
      return
    }

    // Update user's profile with family_id
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setError('You must be logged in to join a family.')
      setLoading(false)
      return
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ family_id: data.id })
      .eq('id', user.id)

    if (updateError) {
      setError('Failed to join family. Please try again.')
      setLoading(false)
      return
    }

    setLoading(false)
    onComplete(data.id)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!familyName.trim()) return

    setLoading(true)
    setError(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setError('You must be logged in to create a family.')
      setLoading(false)
      return
    }

    const { data, error: insertError } = await supabase
      .from('families')
      .insert({ name: familyName.trim() })
      .select('id')
      .single()

    if (insertError || !data) {
      setError('Failed to create family. Please try again.')
      setLoading(false)
      return
    }

    // Update user's profile with family_id
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ family_id: data.id })
      .eq('id', user.id)

    if (updateError) {
      setError('Family created but failed to link your profile. Please try again.')
      setLoading(false)
      return
    }

    setLoading(false)
    onComplete(data.id)
  }

  function handleBack() {
    setMode('choose')
    setError(null)
    setInviteCode('')
    setFamilyName('')
  }

  if (mode === 'choose') {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-gray-900 text-center">Join or Create a Family</h2>
        <p className="text-gray-600 text-center text-sm">
          Every champion needs a team! Join an existing family or start a new one.
        </p>
        <div className="space-y-3 pt-2">
          <button
            onClick={() => setMode('join')}
            className="w-full p-4 border-2 border-gray-200 rounded-xl text-left hover:border-purple-300 hover:bg-purple-50 transition"
          >
            <span className="font-semibold text-gray-900 block">Join existing family</span>
            <span className="text-sm text-gray-500">I have an invite code</span>
          </button>
          <button
            onClick={() => setMode('create')}
            className="w-full p-4 border-2 border-gray-200 rounded-xl text-left hover:border-purple-300 hover:bg-purple-50 transition"
          >
            <span className="font-semibold text-gray-900 block">Create new family</span>
            <span className="text-sm text-gray-500">Start fresh and invite others later</span>
          </button>
        </div>
      </div>
    )
  }

  if (mode === 'join') {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-gray-900 text-center">Join a Family</h2>
        <p className="text-gray-600 text-center text-sm">
          Enter the invite code shared by your family member.
        </p>

        <form onSubmit={handleJoin} className="space-y-4">
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="inviteCode" className="block text-sm font-medium text-gray-700 mb-1">
              Invite Code
            </label>
            <input
              id="inviteCode"
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition text-gray-900 uppercase"
              placeholder="Enter code"
            />
          </div>

          <Button type="submit" loading={loading} className="w-full h-12">
            Join Family
          </Button>

          <button
            type="button"
            onClick={handleBack}
            className="w-full text-sm text-gray-500 hover:text-gray-700 transition"
          >
            Back
          </button>
        </form>
      </div>
    )
  }

  // mode === 'create'
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-gray-900 text-center">Create a Family</h2>
      <p className="text-gray-600 text-center text-sm">
        Give your family a name. You can invite members later.
      </p>

      <form onSubmit={handleCreate} className="space-y-4">
        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="familyName" className="block text-sm font-medium text-gray-700 mb-1">
            Family Name
          </label>
          <input
            id="familyName"
            type="text"
            value={familyName}
            onChange={(e) => setFamilyName(e.target.value)}
            required
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition text-gray-900"
            placeholder="e.g., The Smiths"
          />
        </div>

        <Button type="submit" loading={loading} className="w-full h-12">
          Create Family
        </Button>

        <button
          type="button"
          onClick={handleBack}
          className="w-full text-sm text-gray-500 hover:text-gray-700 transition"
        >
          Back
        </button>
      </form>
    </div>
  )
}
