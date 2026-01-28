'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'

interface InviteModalProps {
  isOpen: boolean
  onClose: () => void
  inviteCode: string
}

export function InviteModal({ isOpen, onClose, inviteCode }: InviteModalProps) {
  const [copied, setCopied] = useState(false)

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

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Invite Family Member">
      <div className="space-y-4">
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

        <Button onClick={onClose} className="w-full">
          Done
        </Button>
      </div>
    </Modal>
  )
}
