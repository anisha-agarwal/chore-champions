'use client'

import { useState } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { RoleSelector, type Role } from '@/components/ui/role-selector'
import { Button } from '@/components/ui/button'
import { AVATAR_OPTIONS } from '@/lib/types'

interface RoleAvatarStepProps {
  onComplete: () => void
}

export function RoleAvatarStep({ onComplete }: RoleAvatarStepProps) {
  const [role, setRole] = useState<Role>('child')
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  async function handleSubmit() {
    setLoading(true)
    setError(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setError('You must be logged in.')
      setLoading(false)
      return
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        role,
        avatar_url: selectedAvatar,
      })
      .eq('id', user.id)

    if (updateError) {
      setError('Failed to save your profile. Please try again.')
      setLoading(false)
      return
    }

    setLoading(false)
    onComplete()
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-bold text-gray-900">Choose Your Role & Avatar</h2>
        <p className="text-gray-600 text-sm mt-1">
          Pick your role and select an avatar to represent you.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Role Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          I am a...
        </label>
        <RoleSelector selected={role} onChange={setRole} />
      </div>

      {/* Avatar Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Choose your avatar
        </label>
        <div className="grid grid-cols-4 gap-3">
          {AVATAR_OPTIONS.map((avatar) => (
            <button
              key={avatar.id}
              type="button"
              onClick={() => setSelectedAvatar(avatar.url)}
              className={`p-2 rounded-xl transition hover:bg-gray-100 ${
                selectedAvatar === avatar.url ? 'ring-2 ring-purple-600 bg-purple-50' : ''
              }`}
            >
              <Image
                src={avatar.url}
                alt={avatar.name}
                width={64}
                height={64}
                className="w-full h-auto"
              />
              <span className="text-xs text-gray-600 mt-1 block">{avatar.name}</span>
            </button>
          ))}
        </div>
      </div>

      <Button
        type="button"
        onClick={handleSubmit}
        loading={loading}
        className="w-full h-12"
      >
        Continue
      </Button>
    </div>
  )
}
