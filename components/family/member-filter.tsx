'use client'

import { cn } from '@/lib/utils'
import { Avatar } from '@/components/ui/avatar'
import type { Profile } from '@/lib/types'

interface MemberFilterProps {
  members: Profile[]
  selectedId: string | null
  currentUserId: string
  onChange: (id: string | null) => void
}

export function MemberFilter({ members, selectedId, currentUserId, onChange }: MemberFilterProps) {
  const children = members.filter((m) => m.role === 'child')

  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
      <button
        onClick={() => onChange(null)}
        className={cn(
          'px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition',
          selectedId === null
            ? 'bg-purple-600 text-white'
            : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
        )}
      >
        All
      </button>

      {children.length > 0 && (
        <button
          onClick={() => onChange('all-kids')}
          className={cn(
            'px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition',
            selectedId === 'all-kids'
              ? 'bg-purple-600 text-white'
              : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
          )}
        >
          All kids
        </button>
      )}

      <button
        onClick={() => onChange(currentUserId)}
        className={cn(
          'px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition',
          selectedId === currentUserId
            ? 'bg-purple-600 text-white'
            : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
        )}
      >
        Me
      </button>

      {members
        .filter((m) => m.id !== currentUserId)
        .map((member) => (
          <button
            key={member.id}
            onClick={() => onChange(member.id)}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition',
              selectedId === member.id
                ? 'bg-purple-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
            )}
          >
            <Avatar
              src={member.avatar_url}
              fallback={member.nickname || member.display_name}
              size="sm"
              className="w-6 h-6"
            />
            <span>{member.nickname || member.display_name.split(' ')[0]}</span>
          </button>
        ))}
    </div>
  )
}
