'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar } from '@/components/ui/avatar'
import { Modal } from '@/components/ui/modal'
import { RoleSelector, type Role } from '@/components/ui/role-selector'
import { AVATAR_OPTIONS, type Profile } from '@/lib/types'

export default function MePage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [nickname, setNickname] = useState('')
  const [role, setRole] = useState<Role>('child')
  const [parentCount, setParentCount] = useState(0)
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
      setRole(data.role)

      // Fetch parent count if user has a family
      if (data.family_id) {
        const { count } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .eq('family_id', data.family_id)
          .eq('role', 'parent')
        setParentCount(count || 0)
      }
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
        role,
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
    <div className="p-4 space-y-6 max-w-2xl mx-auto">
      {/* Horizontal Header */}
      <header className="flex items-center gap-6">
        {/* Avatar on left */}
        <button
          onClick={() => setIsAvatarOpen(true)}
          className="relative flex-shrink-0 group"
        >
          <Avatar
            src={profile.avatar_url}
            fallback={profile.nickname || profile.display_name}
            size="xl"
            className="w-48 h-48"
          />
          <span className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="text-white text-xs font-medium">Change</span>
          </span>
        </button>

        {/* Name and info in middle */}
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">
            {profile.nickname || profile.display_name}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-lg font-semibold text-purple-600">{profile.points}</span>
            <span className="text-gray-500">points</span>
          </div>
          <span className="inline-block px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm mt-2">
            {profile.role === 'parent' ? 'Parent' : 'Kid'}
          </span>
        </div>

      </header>

      {/* Two-column form */}
      <Card>
        <CardContent className="p-6">
          <form id="profile-form" onSubmit={handleSave} className="space-y-5">
            {/* Display Name row */}
            <div className="grid grid-cols-[120px_1fr] items-center gap-4">
              <label className="text-sm font-medium text-gray-500 text-right">
                Display Name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-gray-900"
              />
            </div>

            {/* Nickname row */}
            <div className="grid grid-cols-[120px_1fr] items-start gap-4">
              <label className="text-sm font-medium text-gray-500 text-right pt-2">
                Nickname
              </label>
              <div>
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
            </div>

            {/* Role row */}
            <div className="grid grid-cols-[120px_1fr] items-start gap-4">
              <label className="text-sm font-medium text-gray-500 text-right pt-2">
                Role
              </label>
              <div>
                <RoleSelector
                  selected={role}
                  onChange={setRole}
                  disabled={profile.role === 'parent' && parentCount <= 1}
                />
                {profile.role === 'parent' && parentCount <= 1 && (
                  <p className="text-xs text-amber-600 mt-1">
                    You are the only parent in this family and cannot change your role.
                  </p>
                )}
              </div>
            </div>

            {/* Save button */}
            <div className="flex justify-center pt-2">
              <Button type="submit" disabled={saving} className="px-8">
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
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
