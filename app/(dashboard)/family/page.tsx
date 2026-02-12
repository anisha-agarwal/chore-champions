'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { MemberAvatar } from '@/components/family/member-avatar'
import { InviteModal } from '@/components/family/invite-modal'
import Link from 'next/link'
import type { Profile, Family } from '@/lib/types'

export default function FamilyPage() {
  const [family, setFamily] = useState<Family | null>(null)
  const [members, setMembers] = useState<Profile[]>([])
  const [currentUser, setCurrentUser] = useState<Profile | null>(null)
  const [isInviteOpen, setIsInviteOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [familyName, setFamilyName] = useState('')
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  const fetchData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }

    // Fetch current user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (!profile) {
      setLoading(false)
      return
    }
    setCurrentUser(profile)

    // Fetch family and members
    if (profile.family_id) {
      const { data: familyData } = await supabase
        .from('families')
        .select('*')
        .eq('id', profile.family_id)
        .single()

      setFamily(familyData)

      const { data: membersData } = await supabase
        .from('profiles')
        .select('*')
        .eq('family_id', profile.family_id)
        .order('role', { ascending: false })
        .order('display_name')

      setMembers(membersData || [])
    }

    setLoading(false)
  }, [supabase])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    fetchData()
  }, [fetchData])

  async function handleCreateFamily(e: React.FormEvent) {
    e.preventDefault()
    if (!familyName.trim()) return

    if (!currentUser) {
      setError('Profile not loaded. Please refresh the page.')
      return
    }

    setCreating(true)
    setError(null)

    // Create family
    const { data: newFamily, error: familyError } = await supabase
      .from('families')
      .insert({ name: familyName.trim() })
      .select()
      .single()

    if (familyError || !newFamily) {
      console.error('Failed to create family:', familyError)
      setError('Failed to create family: ' + (familyError?.message || 'Unknown error'))
      setCreating(false)
      return
    }

    // Update profile with family_id and make them a parent
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ family_id: newFamily.id, role: 'parent' })
      .eq('id', currentUser.id)

    if (profileError) {
      console.error('Failed to update profile:', profileError)
      setError('Failed to update profile: ' + profileError.message)
      setCreating(false)
      return
    }

    setFamilyName('')
    fetchData()
    setCreating(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
      </div>
    )
  }

  if (!family) {
    return (
      <div className="p-4 space-y-6">
        <header>
          <h1 className="text-2xl font-bold text-gray-900">Family</h1>
          <p className="text-gray-600 mt-1">Create a family to get started!</p>
        </header>

        <Card>
          <CardContent className="p-6">
            <form onSubmit={handleCreateFamily} className="space-y-4">
              {error && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">
                  {error}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Family Name
                </label>
                <input
                  type="text"
                  value={familyName}
                  onChange={(e) => setFamilyName(e.target.value)}
                  required
                  placeholder="e.g., The Smiths"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-gray-900"
                />
              </div>
              <Button type="submit" disabled={creating} className="w-full">
                {creating ? 'Creating...' : 'Create Family'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="text-center">
          <p className="text-gray-600 mb-2">Or join an existing family</p>
          <Link
            href="/join"
            className="text-purple-600 font-semibold hover:underline"
          >
            Enter invite code
          </Link>
        </div>
      </div>
    )
  }

  const parents = members.filter((m) => m.role === 'parent')
  const children = members.filter((m) => m.role === 'child')

  return (
    <div className="p-4 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{family.name}</h1>
          <p className="text-gray-600">{members.length} members</p>
        </div>
        {currentUser?.role === 'parent' && (
          <Button onClick={() => setIsInviteOpen(true)}>
            Invite
          </Button>
        )}
      </header>

      {parents.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Parents
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {parents.map((member) => (
              <Card key={member.id} className="p-4">
                <MemberAvatar member={member} showPoints />
              </Card>
            ))}
          </div>
        </section>
      )}

      {children.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Kids
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {children.map((member) => (
              <Card key={member.id} className="p-4">
                <MemberAvatar member={member} showPoints />
              </Card>
            ))}
          </div>
        </section>
      )}

      {family.invite_code && (
        <InviteModal
          isOpen={isInviteOpen}
          onClose={() => setIsInviteOpen(false)}
          inviteCode={family.invite_code}
        />
      )}
    </div>
  )
}
