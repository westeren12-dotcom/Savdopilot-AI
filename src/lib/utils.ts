import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

export function uid(prefix = 'id'): string {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`
}

export function nowIso(): string {
  return new Date().toISOString()
}

export function monthKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function daysUntil(iso: string): number {
  const end = new Date(iso).getTime()
  return Math.ceil((end - Date.now()) / 86_400_000)
}

export function formatSom(value: number): string {
  return `${new Intl.NumberFormat('uz-UZ').format(Math.round(value))} so‘m`
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('uz-UZ', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso))
}

export function formatTime(iso: string): string {
  return new Intl.DateTimeFormat('uz-UZ', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

export function addMonths(iso: string, months: number): string {
  const d = new Date(iso)
  d.setMonth(d.getMonth() + months)
  return d.toISOString()
}

export function addDays(iso: string, days: number): string {
  const d = new Date(iso)
  d.setDate(d.getDate() + days)
  return d.toISOString()
}

export function referralCodeFromName(name: string): string {
  const slug = name
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 3)
    .toUpperCase()
    .padEnd(3, 'X')
  const n = Math.floor(100 + Math.random() * 900)
  return `AVEN-${slug}${n}`
}

export function formatTimeRelative(iso: string): string {
  const date = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'hozir'
  if (diffMins < 60) return `${diffMins} daqiqa oldin`
  if (diffHours < 24) return `${diffHours} soat oldin`
  if (diffDays < 7) return `${diffDays} kun oldin`
  return formatDate(iso)
}
