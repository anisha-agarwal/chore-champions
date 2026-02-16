'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'

interface InviteModalProps {
  isOpen: boolean
  onClose: () => void
  inviteCode: string
  familyId: string
  currentUserId: string
}

type Tab = 'code' | 'email'

export function InviteModal({ isOpen, onClose, inviteCode, familyId, currentUserId }: InviteModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>('code')
  const [copied, setCopied] = useState(false)
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [emailSuccess, setEmailSuccess] = useState<string | null>(null)

  const supabase = createClient()

  const inviteLink = typeof window !== 'undefined'
    ? `${window.location.origin}/join/${inviteCode}`
    : `/join/${inviteCode}`

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  async function handleSendInvite(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return

    setSending(true)
    setEmailError(null)
    setEmailSuccess(null)

    // Look up user by email
    const { data: users, error: lookupError } = await supabase
      .rpc('find_user_by_email', { lookup_email: email.trim() })

    if (lookupError) {
      setEmailError('Failed to look up user. Please try again.')
      setSending(false)
      return
    }

    if (!users || users.length === 0) {
      setEmailError('No account found with that email address.')
      setSending(false)
      return
    }

    const foundUser = users[0]

    // Prevent self-invite
    if (foundUser.user_id === currentUserId) {
      setEmailError('You cannot invite yourself.')
      setSending(false)
      return
    }

    // Check if user already has a family
    if (foundUser.has_family) {
      setEmailError('This user is already in a family.')
      setSending(false)
      return
    }

    // Insert the invite
    const { error: insertError } = await supabase
      .from('family_invites')
      .insert({
        family_id: familyId,
        invited_by: currentUserId,
        invited_user_id: foundUser.user_id,
      })

    if (insertError) {
      // Handle duplicate pending invite
      if (insertError.code === '23505') {
        setEmailError('An invite is already pending for this user.')
      } else {
        setEmailError('Failed to send invite. Please try again.')
      }
      setSending(false)
      return
    }

    setEmailSuccess(`Invite sent to ${foundUser.display_name}!`)
    setEmail('')
    setSending(false)
  }

  function handleClose() {
    setEmail('')
    setEmailError(null)
    setEmailSuccess(null)
    setActiveTab('code')
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Invite Family Member">
      <div className="space-y-4">
        {/* Tab buttons */}
        <div role="tablist" className="flex border-b border-gray-200">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'code'}
            aria-controls="tab-panel-code"
            onClick={() => setActiveTab('code')}
            className={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'code'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Share Code
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'email'}
            aria-controls="tab-panel-email"
            onClick={() => setActiveTab('email')}
            className={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'email'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Invite by Email
          </button>
        </div>

        {/* Share Code tab */}
        {activeTab === 'code' && (
          <div id="tab-panel-code" role="tabpanel" className="space-y-4">
            <p className="text-gray-600">
              Share this code or link with family members to invite them to join.
            </p>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Invite Code
              </label>
              <div className="flex gap-2">
                <div className="flex-1 px-4 py-3 bg-gray-100 rounded-lg text-center font-mono text-2xl tracking-widest">
                  {inviteCode.toUpperCase()}
                </div>
                <Button
                  onClick={() => copyToClipboard(inviteCode)}
                  variant="secondary"
                >
                  {copied ? 'Copied!' : 'Copy'}
                </Button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Invite Link
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={inviteLink}
                  className="flex-1 px-3 py-2 bg-gray-100 rounded-lg text-sm text-gray-900 truncate"
                />
                <Button
                  onClick={() => copyToClipboard(inviteLink)}
                  variant="secondary"
                >
                  Copy
                </Button>
              </div>
            </div>

            <Button onClick={handleClose} className="w-full">
              Done
            </Button>
          </div>
        )}

        {/* Invite by Email tab */}
        {activeTab === 'email' && (
          <div id="tab-panel-email" role="tabpanel" className="space-y-4">
            <p className="text-gray-600">
              Enter the email address of an existing user to invite them to your family.
            </p>

            <form onSubmit={handleSendInvite} className="space-y-4">
              {emailError && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">
                  {emailError}
                </div>
              )}

              {emailSuccess && (
                <div className="bg-green-50 text-green-600 p-3 rounded-lg text-sm">
                  {emailSuccess}
                </div>
              )}

              <div>
                <label htmlFor="invite-email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address
                </label>
                <input
                  id="invite-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="user@example.com"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-gray-900"
                />
              </div>

              <Button type="submit" disabled={sending} className="w-full">
                {sending ? 'Sending...' : 'Send Invite'}
              </Button>
            </form>
          </div>
        )}
      </div>
    </Modal>
  )
}
