'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { Avatar } from '@/components/ui/avatar'
import { Modal } from '@/components/ui/modal'
import { RoleSelector, type Role } from '@/components/ui/role-selector'
import { UnderlineInput } from '@/components/ui/underline-input'
import { Button } from '@/components/ui/button'
import { AVATAR_OPTIONS, type Profile } from '@/lib/types'

export default function MePage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [nickname, setNickname] = useState('')
  const [role, setRole] = useState<Role>('child')
  const [parentCount, setParentCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    fetchProfile()
  }, [fetchProfile])

  async function handleSave() {
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
      setSaving(false)
      setSaveSuccess(true)

      // Reset success state after 1.5s
      setTimeout(() => {
        setSaveSuccess(false)
      }, 1500)

      fetchProfile()
    } else {
      setSaving(false)
    }
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
    <div className="min-h-screen flex flex-col bg-white">
      {/* Page title */}
      <header className="px-6 pt-6 pb-2">
        <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
      </header>

      <main className="flex-1 px-6 pt-4 pb-32">
        <div className="max-w-md mx-auto">
          {/* Avatar Section */}
          <section className="flex flex-col items-center mb-10">
            <button
              onClick={() => setIsAvatarOpen(true)}
              className="relative group"
              aria-label="Change avatar"
            >
              <Avatar
                src={profile.avatar_url}
                fallback={profile.nickname || profile.display_name}
                size="2xl"
              />
              {/* Edit icon overlay - centered, visible on hover */}
              <span className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="white"
                  className="w-8 h-8"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125"
                  />
                </svg>
              </span>
            </button>
            <p className="text-sm text-gray-400 mt-3">Tap to change avatar</p>
          </section>

          <form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
            {/* Personal Info Section */}
            <section className="mb-8">
              <h2 className="text-xs font-bold tracking-widest text-gray-400 uppercase mb-4">
                Personal Info
              </h2>
              <div className="space-y-6">
                <UnderlineInput
                  label="Display Name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                />
                <UnderlineInput
                  label="Nickname"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="e.g., Baby Bison, Panther"
                  helperText="A fun name to display on tasks"
                />
              </div>
            </section>

            {/* Role Section */}
            <section className="mb-8">
              <h2 className="text-xs font-bold tracking-widest text-gray-400 uppercase mb-4">
                Role
              </h2>
              <RoleSelector
                selected={role}
                onChange={setRole}
                disabled={profile.role === 'parent' && parentCount <= 1}
              />
              {profile.role === 'parent' && parentCount <= 1 && (
                <p className="text-xs text-amber-600 mt-2">
                  You are the only parent in this family and cannot change your role.
                </p>
              )}
            </section>

            {/* Sign Out */}
            <section className="mt-8">
              <Button
                type="button"
                variant="ghost"
                onClick={handleSignOut}
                className="w-full text-red-600 hover:text-red-700 hover:bg-red-50 justify-start px-0"
              >
                Sign Out
              </Button>
            </section>
          </form>
        </div>
      </main>

      {/* Save button footer */}
      <footer className="px-6 pb-6">
        <div className="max-w-md mx-auto">
          <Button
            type="button"
            onClick={handleSave}
            loading={saving}
            success={saveSuccess}
            className="w-full h-12"
          >
            Save Changes
          </Button>
        </div>
      </footer>

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
