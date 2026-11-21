import { api } from '@/lib/api-client'
import type { AiChatRequest, AiChatResult, AiProvider } from './types'

const LOCALES = ['uz', 'ru', 'en'] as const
type Locale = (typeof LOCALES)[number]

function toLocale(value: string | undefined): Locale {
  return LOCALES.includes(value as Locale) ? (value as Locale) : 'uz'
}

/**
 * Production path: the browser never holds the model API key.
 *
 * It calls `/api/ai/chat` on the Vercel backend, which verifies the Firebase
 * ID token, resolves the caller's organization, enforces the AI quota and talks
 * to the provider with a server-only key.
 */
export const edgeAiProvider: AiProvider = {
  async chat(request: AiChatRequest): Promise<AiChatResult> {
    const messages = request.messages
      .filter((message) => message.role !== 'system')
      .slice(-20)
      .map((message) => ({
        role: message.role === 'assistant' ? ('assistant' as const) : ('user' as const),
        content: message.content.slice(0, 4000),
      }))

    if (messages.length === 0) {
      throw new Error('AI so‘rovi bo‘sh.')
    }

    const products = request.context.products
      .filter((product) => product.active)
      .slice(0, 50)
      .map((product) => ({
        name: product.name,
        price: product.price,
        stock: product.stock,
        description: product.description.slice(0, 300),
      }))

    const { data } = await api.ai.chat({
      messages,
      context: {
        businessName: request.context.business.name,
        locale: toLocale(request.context.business.aiLanguage),
        ...(products.length ? { products } : {}),
      },
    })

    return { text: data.reply }
  },
}
