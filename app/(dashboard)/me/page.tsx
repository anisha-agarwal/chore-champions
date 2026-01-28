'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar } from '@/components/ui/avatar'
import { Modal } from '@/components/ui/modal'
import { AVATAR_OPTIONS, type Profile } from '@/lib/types'

export default function MePage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [nickname, setNickname] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isAvatarOpen, setIsAvatarOpen] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const fetchProfile = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }

    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (data) {
      setProfile(data)
      setDisplayName(data.display_name)
      setNickname(data.nickname || '')
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    fetchProfile()
  }, [fetchProfile])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!profile) return

    setSaving(true)

    const { error } = await supabase
      .from('profiles')
      .update({
        display_name: displayName,
        nickname: nickname || null,
      })
      .eq('id', profile.id)

    if (!error) {
      fetchProfile()
    }
    setSaving(false)
  }

  async function handleAvatarSelect(avatarUrl: string) {
    if (!profile) return

    const { error } = await supabase
      .from('profiles')
      .update({ avatar_url: avatarUrl })
      .eq('id', profile.id)

    if (!error) {
      fetchProfile()
    }
    setIsAvatarOpen(false)
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="p-4 text-center">
        <p>Profile not found</p>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-6">
      <header className="text-center">
        <button
          onClick={() => setIsAvatarOpen(true)}
          className="relative inline-block"
        >
          <Avatar
            src={profile.avatar_url}
            fallback={profile.nickname || profile.display_name}
            size="xl"
            className="w-24 h-24 mx-auto"
          />
          <span className="absolute bottom-0 right-0 w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white shadow-lg">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </span>
        </button>
        <h1 className="text-2xl font-bold text-gray-900 mt-4">
          {profile.nickname || profile.display_name}
        </h1>
        <div className="flex items-center justify-center gap-2 mt-2">
          <span className="text-2xl font-bold text-purple-600">{profile.points}</span>
          <span className="text-gray-600">points</span>
        </div>
        <span className="inline-block px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm mt-2">
          {profile.role === 'parent' ? 'Parent' : 'Kid'}
        </span>
      </header>

      <Card>
        <CardContent className="p-4">
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Display Name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-gray-900"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nickname
              </label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="e.g., Baby Bison, Panther"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-gray-900"
              />
              <p className="text-xs text-gray-500 mt-1">
                A fun name to display on tasks
              </p>
            </div>

            <Button type="submit" disabled={saving} className="w-full">
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Button
        variant="ghost"
        onClick={handleSignOut}
        className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
      >
        Sign Out
      </Button>

      {/* Avatar Selection Modal */}
      <Modal
        isOpen={isAvatarOpen}
        onClose={() => setIsAvatarOpen(false)}
        title="Choose Avatar"
      >
        <div className="grid grid-cols-4 gap-3">
          {AVATAR_OPTIONS.map((avatar) => (
            <button
              key={avatar.id}
              onClick={() => handleAvatarSelect(avatar.url)}
              className={`p-2 rounded-xl transition hover:bg-gray-100 ${
                profile.avatar_url === avatar.url ? 'ring-2 ring-purple-600 bg-purple-50' : ''
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
      </Modal>
    </div>
  )
}
