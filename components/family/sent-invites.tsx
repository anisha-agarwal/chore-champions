'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar } from '@/components/ui/avatar'
import type { FamilyInvite, Profile } from '@/lib/types'

type SentInvite = FamilyInvite & {
  invited_user: Pick<Profile, 'display_name' | 'avatar_url'>
}

interface SentInvitesProps {
  familyId: string
}

export function SentInvites({ familyId }: SentInvitesProps) {
  const [invites, setInvites] = useState<SentInvite[]>([])
  const [loading, setLoading] = useState(true)

  const supabase = createClient()

  const fetchSentInvites = useCallback(async () => {
    const { data, error } = await supabase
      .from('family_invites')
      .select(`
        *,
        invited_user:invited_user_id ( display_name, avatar_url )
      `)
      .eq('family_id', familyId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Failed to fetch sent invites:', error)
    } else {
      setInvites((data as unknown as SentInvite[]) || [])
    }

    setLoading(false)
  }, [supabase, familyId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    fetchSentInvites()
  }, [fetchSentInvites])

  if (loading || invites.length === 0) {
    return null
  }

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
        Pending Invites Sent
      </h2>
      {invites.map((invite) => (
        <Card key={invite.id}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Avatar
                src={invite.invited_user.avatar_url}
                fallback={invite.invited_user.display_name}
                size="md"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">
                  {invite.invited_user.display_name}
                </p>
              </div>
              <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
                Pending
              </span>
            </div>
          </CardContent>
        </Card>
      ))}
    </section>
  )
}
