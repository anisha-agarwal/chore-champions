import { Avatar } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import type { Profile } from '@/lib/types'

interface MemberAvatarProps {
  member: Profile
  showPoints?: boolean
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

export function MemberAvatar({ member, showPoints = false, size = 'lg' }: MemberAvatarProps) {
  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <Avatar
          src={member.avatar_url}
          fallback={member.nickname || member.display_name}
          size={size}
        />
        {member.role === 'parent' && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-yellow-400 rounded-full flex items-center justify-center">
            <svg className="w-3 h-3 text-yellow-800" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          </span>
        )}
      </div>
      <span className={cn(
        'mt-2 font-medium text-gray-900 text-center',
        size === 'sm' && 'text-xs',
        size === 'md' && 'text-sm',
        size === 'lg' && 'text-base',
        size === 'xl' && 'text-lg'
      )}>
        {member.nickname || member.display_name}
      </span>
      {showPoints && (
        <span className="text-sm text-purple-600 font-semibold">
          {member.points} pts
        </span>
      )}
    </div>
  )
}
