import type { Business, Product } from '@/types'

export interface AiContext {
  business: Business
  products: Product[]
  faq?: string[]
}

export interface AiChatRequest {
  messages: { role: 'user' | 'assistant' | 'system'; content: string }[]
  context: AiContext
}

export interface AiChatResult {
  text: string
  createdOrder?: {
    productName: string
    quantity: number
    customerName?: string
    phone?: string
  }
}

export interface AiProvider {
  chat(request: AiChatRequest): Promise<AiChatResult>
}
