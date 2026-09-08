import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

interface BadgeProps {
  children: ReactNode
  className?: string
  tone?: 'gold' | 'red' | 'green' | 'blue' | 'yellow' | 'gray'
}

export function Badge({ children, className, tone = 'gray' }: BadgeProps) {
  const toneStyles = {
    gold: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
    red: 'bg-red-500/10 text-red-500 border-red-500/20',
    green: 'bg-green-500/10 text-green-500 border-green-500/20',
    blue: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    yellow: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
    gray: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold',
        toneStyles[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}
