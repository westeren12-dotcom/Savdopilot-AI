import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-2xl border bg-card p-5 shadow-sm', className)}
      {...props}
    />
  )
}

export function Badge({
  className,
  tone = 'muted',
  ...props
}: HTMLAttributes<HTMLSpanElement> & { 
  tone?: 'muted' | 'gold' | 'ok' | 'warn' | 'danger'
}) {
  const tones = {
    muted: 'bg-muted text-muted-foreground',
    gold: 'bg-accent/30 text-accent-foreground',
    ok: 'bg-primary/15 text-primary',
    warn: 'bg-accent/40 text-accent-foreground',
    danger: 'bg-destructive/15 text-destructive',
  }
  
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
        tones[tone],
        className,
      )}
      {...props}
    />
  )
}
