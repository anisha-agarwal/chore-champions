import { HTMLAttributes, forwardRef } from 'react'
import Image from 'next/image'
import { cn, getInitials } from '@/lib/utils'

export interface AvatarProps extends HTMLAttributes<HTMLDivElement> {
  src?: string | null
  alt?: string
  fallback?: string
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl'
}

const Avatar = forwardRef<HTMLDivElement, AvatarProps>(
  ({ className, src, alt = '', fallback, size = 'md', ...props }, ref) => {
    const sizeClasses = {
      sm: 'h-8 w-8 text-xs',
      md: 'h-10 w-10 text-sm',
      lg: 'h-12 w-12 text-base',
      xl: 'h-16 w-16 text-lg',
      '2xl': 'h-28 w-28 text-xl',
    }

    const imageSizes = {
      sm: 32,
      md: 40,
      lg: 48,
      xl: 64,
      '2xl': 112,
    }

    return (
      <div
        ref={ref}
        className={cn(
          'relative rounded-full overflow-hidden bg-purple-100 flex items-center justify-center',
          sizeClasses[size],
          className
        )}
        {...props}
      >
        {src ? (
          <Image
            src={src}
            alt={alt}
            width={imageSizes[size]}
            height={imageSizes[size]}
            className="object-cover w-full h-full"
          />
        ) : (
          <span className="font-semibold text-purple-600">
            {fallback ? getInitials(fallback) : '?'}
          </span>
        )}
      </div>
    )
  }
)

Avatar.displayName = 'Avatar'

export { Avatar }
