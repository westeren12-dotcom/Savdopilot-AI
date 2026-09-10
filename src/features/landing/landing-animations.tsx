// SavdoPilot landing animations — adapted from React Bits (chat/typing/typewriter),
// Motion Primitives (staggered workflow, animated numbers) and Aceternity-style
// status transitions, but tuned to the existing warm teal/cream identity.
// All motion respects prefers-reduced-motion.
import { useEffect, useRef, useState } from 'react'
import {
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useSpring,
  type Variants,
} from 'framer-motion'
import { Bot, CheckCircle2, Clock, FileText, Sparkles, User, Wallet } from 'lucide-react'
import { cn } from '@/lib/utils'

/* ---------------- Typing indicator (React Bits-style, 3 dots) ---------------- */

export function TypingDots({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1', className)} aria-label="AI is typing">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-primary/70"
          animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
        />
      ))}
    </span>
  )
}

/* ---------------- Slow typewriter for hero headline ---------------- */

export function useTypewriter(words: string[], enabled = true) {
  const reduced = useReducedMotion()
  const [text, setText] = useState(enabled && !reduced ? '' : words[0] ?? '')
  const [wi, setWi] = useState(0)

  useEffect(() => {
    if (reduced || !enabled) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>
    const word = words[wi % words.length] ?? ''
    let i = 0
    let deleting = false
    const tick = () => {
      if (cancelled) return
      if (!deleting) {
        i++
        setText(word.slice(0, i))
        if (i >= word.length) {
          deleting = true
          timer = setTimeout(tick, 2200)
          return
        }
      } else {
        i--
        setText(word.slice(0, i))
        if (i <= 0) {
          setWi((w) => (w + 1) % words.length)
          return
        }
      }
      timer = setTimeout(tick, deleting ? 28 : 55)
    }
    timer = setTimeout(tick, 400)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [wi, words, reduced, enabled])

  return text
}

/* ---------------- Animated number (Motion Primitives style) ---------------- */

export function AnimatedNumber({
  value,
  prefix = '',
  className,
}: {
  value: number
  prefix?: string
  className?: string
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '-40px' })
  const reduced = useReducedMotion()
  const mv = useMotionValue(0)
  const spring = useSpring(mv, { stiffness: 60, damping: 20 })
  const [display, setDisplay] = useState('0')

  useEffect(() => {
    if (inView) mv.set(value)
  }, [inView, value, mv])

  useEffect(() => {
    if (reduced) {
      setDisplay(String(value))
      return
    }
    const unsub = spring.on('change', (v) => setDisplay(Math.round(v).toLocaleString('en-US')))
    return unsub
  }, [spring, reduced, value])

  return (
    <span ref={ref} className={className}>
      {prefix}
      {display}
    </span>
  )
}

/* ---------------- Stagger helpers ---------------- */

export const staggerParent: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.14, delayChildren: 0.1 } },
}

export const staggerChild: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
}

/* ---------------- AI Sales hero: looping chat with typing indicator ---------------- */

type ChatLine = { who: 'customer' | 'ai'; text: string }

export function AiSalesChat({ lines }: { lines: ChatLine[] }) {
  const reduced = useReducedMotion()
  const [visible, setVisible] = useState(reduced ? lines.length : 1)
  const [typing, setTyping] = useState(false)

  useEffect(() => {
    if (reduced) return
    let alive = true
    let t1: ReturnType<typeof setTimeout>
    let t2: ReturnType<typeof setTimeout>

    function step(idx: number) {
      if (!alive) return
      if (idx >= lines.length) {
        // pause, then restart the loop
        t1 = setTimeout(() => {
          if (!alive) return
          setVisible(1)
          step(1)
        }, 3600)
        return
      }
      const line = lines[idx]
      if (line.who === 'ai') {
        setTyping(true)
        t1 = setTimeout(() => {
          if (!alive) return
          setTyping(false)
          setVisible(idx + 1)
          t2 = setTimeout(() => step(idx + 1), 900)
        }, 1100)
      } else {
        setVisible(idx + 1)
        t2 = setTimeout(() => step(idx + 1), 1400)
      }
    }

    t1 = setTimeout(() => step(0), 600)
    return () => {
      alive = false
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [lines, reduced])

  return (
    <div className="space-y-3">
      {lines.slice(0, visible).map((line, i) => (
        <motion.div
          key={`${i}-${line.text}`}
          initial={{ opacity: 0, y: 10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className={cn('flex gap-2.5', line.who === 'ai' && 'flex-row-reverse')}
        >
          <div
            className={cn(
              'flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
              line.who === 'ai' ? 'bg-primary/10' : 'bg-muted',
            )}
          >
            {line.who === 'ai' ? (
              <Bot className="h-3.5 w-3.5 text-primary" />
            ) : (
              <User className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </div>
          <div
            className={cn(
              'max-w-[85%] rounded-xl px-3 py-2 text-xs md:text-sm',
              line.who === 'ai' ? 'bg-primary/10' : 'bg-muted',
            )}
          >
            {line.text}
          </div>
        </motion.div>
      ))}
      {typing && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-row-reverse gap-2.5"
        >
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <Bot className="h-3.5 w-3.5 text-primary" />
          </div>
          <div className="rounded-xl bg-primary/10 px-3 py-2.5">
            <TypingDots />
          </div>
        </motion.div>
      )}
    </div>
  )
}

/* ---------------- Invoices: status pill (Aceternity-style transition) ---------------- */

type InvStatus = 'unpaid' | 'overdue' | 'promise' | 'paid'

const STATUS_STYLES: Record<InvStatus, { label: string; cls: string }> = {
  unpaid: { label: 'Unpaid', cls: 'bg-muted text-muted-foreground border-border' },
  overdue: { label: 'Overdue', cls: 'bg-destructive/10 text-destructive border-destructive/30' },
  promise: { label: 'Promise', cls: 'bg-accent/20 text-accent-foreground border-accent/40' },
  paid: { label: 'Paid', cls: 'bg-primary/10 text-primary border-primary/30' },
}

export function StatusPill({ status, className }: { status: InvStatus; className?: string }) {
  const s = STATUS_STYLES[status]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold',
        s.cls,
        className,
      )}
    >
      {status === 'paid' && <CheckCircle2 className="h-3 w-3" />}
      {status === 'overdue' && <Clock className="h-3 w-3" />}
      {status === 'promise' && <Sparkles className="h-3 w-3" />}
      {s.label}
    </span>
  )
}

/** An invoice card whose status cycles unpaid → overdue → promise → paid. */
export function InvoiceStatusCard({ labels }: { labels: Record<InvStatus, string> }) {
  const reduced = useReducedMotion()
  const [status, setStatus] = useState<InvStatus>('unpaid')
  const order: InvStatus[] = ['unpaid', 'overdue', 'promise', 'paid']

  useEffect(() => {
    if (reduced) return
    const t = setInterval(() => {
      setStatus((s) => order[(order.indexOf(s) + 1) % order.length])
    }, 2000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced])

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-500/10">
            <FileText className="h-4.5 w-4.5 text-green-500" />
          </div>
          <div>
            <p className="text-sm font-semibold">INV-1042</p>
            <p className="text-xs text-muted-foreground">{labels[status]}</p>
          </div>
        </div>
        <motion.div
          key={status}
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 22 }}
        >
          <StatusPill status={status} />
        </motion.div>
      </div>
      <div className="mt-3 flex items-end justify-between">
        <p className="font-display text-2xl">$1,240</p>
        <div className="flex h-1.5 w-24 overflow-hidden rounded-full bg-muted">
          <motion.div
            className="h-full rounded-full bg-primary"
            animate={{ width: status === 'paid' ? '100%' : status === 'promise' ? '62%' : status === 'overdue' ? '30%' : '12%' }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        </div>
      </div>
    </div>
  )
}

/* ---------------- Collections workflow: staggered vertical timeline ---------------- */

const WF_ICONS = [FileText, Clock, Sparkles, Wallet, CheckCircle2]

export function CollectionsWorkflow({
  steps,
  className,
}: {
  steps: string[]
  className?: string
}) {
  const ref = useRef<HTMLOListElement>(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })
  const reduced = useReducedMotion()

  return (
    <motion.ol
      ref={ref}
      variants={staggerParent}
      initial={reduced ? 'show' : 'hidden'}
      animate={inView || reduced ? 'show' : 'hidden'}
      className={cn('relative space-y-3', className)}
    >
      {steps.map((s, i) => {
        const Icon = WF_ICONS[i % WF_ICONS.length]
        const last = i === steps.length - 1
        return (
          <motion.li
            key={s}
            variants={staggerChild}
            className="relative flex items-center gap-3 pl-1"
          >
            {/* connector line */}
            {!last && (
              <motion.span
                aria-hidden
                className="absolute left-[19px] top-9 h-[calc(100%-1.5rem)] w-px bg-border"
                initial={{ scaleY: 0 }}
                animate={inView || reduced ? { scaleY: 1 } : {}}
                transition={{ delay: 0.3 + i * 0.14, duration: 0.35 }}
                style={{ originY: 0 }}
              />
            )}
            <span
              className={cn(
                'z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border',
                last ? 'border-primary/40 bg-primary/10' : 'border-border bg-card',
              )}
            >
              <Icon className={cn('h-4 w-4', last ? 'text-primary' : 'text-muted-foreground')} />
            </span>
            <span className={cn('text-sm', last && 'font-semibold text-primary')}>{s}</span>
            {last && (
              <motion.span
                initial={{ scale: 0 }}
                animate={inView || reduced ? { scale: 1 } : {}}
                transition={{ delay: 1.1, type: 'spring', stiffness: 260, damping: 18 }}
              >
                <CheckCircle2 className="h-4 w-4 text-primary" />
              </motion.span>
            )}
          </motion.li>
        )
      })}
    </motion.ol>
  )
}

/* ---------------- Shared: gentle floating wrapper ---------------- */

export function Floating({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const reduced = useReducedMotion()
  if (reduced) return <>{children}</>
  return (
    <motion.div
      animate={{ y: [0, -8, 0] }}
      transition={{ duration: 5 + delay, repeat: Infinity, ease: 'easeInOut', delay }}
    >
      {children}
    </motion.div>
  )
}
