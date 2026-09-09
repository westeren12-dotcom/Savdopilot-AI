import type { Business, Product, Invoice } from '@/types'

export interface AiContext {
  business: Business
  products: Product[]
  invoices?: Invoice[]
  faq?: string[]
  customerInfo?: {
    name?: string
    email?: string
    phone?: string
    leadStatus?: string
  }
  conversationHistory?: Array<{
    role: 'user' | 'assistant'
    content: string
    timestamp: string
  }>
}

export interface AiChatRequest {
  messages: { role: 'user' | 'assistant' | 'system'; content: string }[]
  context: AiContext
  task?: 'sales' | 'collections' | 'general'
}

export interface AiChatResult {
  text: string
  createdOrder?: {
    productName: string
    quantity: number
    customerName?: string
    phone?: string
  }
  structuredResponse?: {
    intent: string
    promised_date?: string
    action: string
    confidence: number
    reasoning?: string
  }
}

export interface AiProvider {
  chat(request: AiChatRequest): Promise<AiChatResult>
  analyzePaymentResponse?(message: string): {
    intent: string
    promised_date?: string
    action: string
    confidence: number
  }
  generatePaymentReminder?(invoice: {
    invoiceNumber: string
    amount: number
    dueDate: string
    customerName: string
    daysOverdue: number
  }): string
}
