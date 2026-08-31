import type { IntegrationStatus } from '@/types'

export interface TelegramConnectInput {
  botToken: string
}

export interface TelegramService {
  connect(input: TelegramConnectInput): Promise<{
    status: IntegrationStatus
    botUsername: string
  }>
  disconnect(): Promise<void>
}

/**
 * Production: Edge Function sets webhook to /functions/v1/telegram-webhook.
 * Token is stored server-side, never in the React bundle.
 */
export const telegramService: TelegramService = {
  async connect(input) {
    const token = input.botToken.trim()
    if (!token) throw new Error('Bot token kiritilmagan')
    const username = token.includes(':') ? `@bot_${token.slice(0, 6)}` : '@savdopilot_bot'
    return { status: 'connected', botUsername: username }
  },
  async disconnect() {
    return
  },
}
