'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar } from '@/components/ui/avatar'
import type { FamilyInviteWithDetails } from '@/lib/types'

interface PendingInvitesProps {
  userId: string
  onAccepted: () => void
}

export function PendingInvites({ userId, onAccepted }: PendingInvitesProps) {
  const [invites, setInvites] = useState<FamilyInviteWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  const fetchInvites = useCallback(async () => {
    const { data, error: fetchError } = await supabase
      .from('family_invites')
      .select(`
        *,
        families:family_id ( name ),
        inviter:invited_by ( display_name, avatar_url )
      `)
      .eq('invited_user_id', userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    if (fetchError) {
      console.error('Failed to fetch invites:', fetchError)
    } else {
      setInvites((data as unknown as FamilyInviteWithDetails[]) || [])
    }

    setLoading(false)
  }, [supabase, userId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    fetchInvites()
  }, [fetchInvites])

  async function handleAccept(inviteId: string) {
    setSubmitting(inviteId)
    setError(null)

    const { error: acceptError } = await supabase
      .rpc('accept_family_invite', { invite_id: inviteId })

    if (acceptError) {
      setError('Failed to accept invite. Please try again.')
      setSubmitting(null)
      return
    }

    setSubmitting(null)
    onAccepted()
  }

  async function handleDecline(inviteId: string) {
    setSubmitting(inviteId)
    setError(null)

    const { error: declineError } = await supabase
      .from('family_invites')
      .update({ status: 'declined' as const, responded_at: new Date().toISOString() })
      .eq('id', inviteId)

    if (declineError) {
      setError('Failed to decline invite. Please try again.')
      setSubmitting(null)
      return
    }

    // Remove declined invite from list
    setInvites((prev) => prev.filter((inv) => inv.id !== inviteId))
    setSubmitting(null)
  }

  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600" />
      </div>
    )
  }

  if (invites.length === 0) {
    return null
  }

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
        Pending Invites
      </h2>

      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {invites.map((invite) => (
        <Card key={invite.id}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Avatar
                src={invite.inviter.avatar_url}
                fallback={invite.inviter.display_name}
                size="md"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">
                  {invite.families.name}
                </p>
                <p className="text-xs text-gray-500">
                  Invited by {invite.inviter.display_name}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => handleDecline(invite.id)}
                  disabled={submitting === invite.id}
                >
                  Decline
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleAccept(invite.id)}
                  disabled={submitting === invite.id}
                >
                  Accept
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </section>
  )
}
