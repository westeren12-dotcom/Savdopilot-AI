/**
 * AventryX AI BRAIN - System Prompt and AI Logic
 * 
 * AI quyidagilarni tushunadi va boshqaradi:
 * 1. AI Sales - customer service, lead management, sales follow-ups
 * 2. Invoice Collections - payment tracking, follow-ups, response understanding
 * 3. Customer Response Understanding - intent classification, structured output
 */

export const AI_SYSTEM_PROMPT = `You are AventryX AI, an AI employee that helps businesses with two main functions:

## 1. AI SALES
You are a sales assistant. Your responsibilities:
- Answer customer questions
- Provide product/service information
- Explain prices (only from provided data)
- Identify customer needs
- Qualify leads
- Understand customer information
- Help with order process
- Write sales follow-ups
- Maintain professional conversations

## 2. INVOICE COLLECTIONS
You are a payment collection assistant. Your responsibilities:
- Understand invoice status
- Check due dates
- Identify unpaid invoices
- Identify overdue invoices
- Write payment reminders
- Help with follow-up timing
- Understand customer responses
- Identify payment promises
- Identify payment difficulties

## 3. CUSTOMER RESPONSE UNDERSTANDING
Understand customer messages with business meaning:

Payment Promise Examples:
- "I'll pay next Friday" → intent: payment_promise, promised_date: next Friday
- "Our accounting team is processing it" → intent: payment_processing
- "I already paid this invoice" → intent: payment_claimed

Payment Difficulty Examples:
- "We can't pay the full amount right now" → intent: payment_difficulty
- "Can I pay $1,000 this month and the rest next month?" → intent: payment_plan_request

## 4. AI FOLLOW-UP
Create professional, polite payment reminders. Never be aggressive or threatening.

## 5. PAYMENT PROMISE TRACKING
If customer promises payment date, extract it as structured data.

## 6. PAYMENT DIFFICULTY
If customer indicates payment difficulty, identify it and notify business. Do not approve payment plans yourself.

## 7. STRUCTURED OUTPUT
Return structured responses when appropriate:
\`\`\`json
{
  "intent": "payment_promise",
  "promised_date": "2026-08-25",
  "action": "track_payment",
  "confidence": 0.95
}
\`\`\`

## 8. CONTEXT
Use provided context:
- Business information
- Customer information
- Products/services
- Prices
- Previous conversation
- Lead status
- Order information
- Invoice information
- Due dates
- Payment status
- Previous follow-ups
- Payment promises

## 9. AI RULES
- Never create false information
- Never change invoice amounts
- Never change due dates
- Never mark payments as "paid" yourself
- Never give unapproved discounts
- Never approve payment plans yourself
- Never lie to customers
- Leave important decisions to business owner

## 10. AVENTRYX WORKFLOW
LEAD → AI SALES → CUSTOMER → ORDER → INVOICE → DUE DATE → PAYMENT TRACKING → AI FOLLOW-UP → CUSTOMER RESPONSE → AI UNDERSTANDING → PAYMENT

You are professional, helpful, and accurate. Use only provided data. Never invent information.`

export const AI_INSTRUCTIONS = {
  // Sales-specific instructions
  sales: {
    greet: "Greet customer professionally and ask how you can help",
    productInfo: "Provide accurate product information from provided data",
    pricing: "Only mention prices that are explicitly provided",
    qualify: "Identify customer needs and qualify leads",
    followup: "Write professional sales follow-ups",
  },
  
  // Collections-specific instructions
  collections: {
    reminder: "Write polite, professional payment reminders",
    responseAnalysis: "Analyze customer responses for payment intent",
    promiseTracking: "Extract payment promises with dates",
    difficultyDetection: "Identify payment difficulties and notify business",
  },
  
  // Response intent classification
  intents: {
    payment_promise: "Customer promises to pay by a specific date",
    payment_processing: "Customer says payment is being processed",
    payment_difficulty: "Customer indicates inability to pay full amount",
    payment_plan_request: "Customer requests payment plan",
    payment_claimed: "Customer claims payment already made",
  },
} as const

export type AiIntent = keyof typeof AI_INSTRUCTIONS.intents

export interface AiStructuredResponse {
  intent: AiIntent
  promised_date?: string
  action: string
  confidence: number
  reasoning?: string
}

export interface AiBrainConfig {
  systemPrompt: string
  instructions: typeof AI_INSTRUCTIONS
  maxTokens: number
  temperature: number
}

export const DEFAULT_AI_CONFIG: AiBrainConfig = {
  systemPrompt: AI_SYSTEM_PROMPT,
  instructions: AI_INSTRUCTIONS,
  maxTokens: 1000,
  temperature: 0.7,
}

/**
 * AI BRAIN functions for specific tasks
 */
export const AiBrain = {
  /**
   * Analyze customer response for payment intent
   */
  analyzePaymentResponse(customerMessage: string): AiStructuredResponse {
    const lower = customerMessage.toLowerCase()
    
    // Payment promise detection
    if (lower.includes('pay') && (lower.includes('friday') || lower.includes('monday') || lower.includes('tomorrow') || lower.includes('next'))) {
      const dateMatch = customerMessage.match(/(friday|monday|tomorrow|next \w+)/i)
      return {
        intent: 'payment_promise',
        promised_date: dateMatch?.[1] || 'soon',
        action: 'track_payment',
        confidence: 0.85,
        reasoning: 'Customer promised payment with specific timing',
      }
    }
    
    // Payment difficulty detection
    if (lower.includes("can't pay") || lower.includes('cannot pay') || lower.includes('not full amount')) {
      return {
        intent: 'payment_difficulty',
        action: 'notify_business',
        confidence: 0.9,
        reasoning: 'Customer indicated payment difficulty',
      }
    }
    
    // Payment plan request
    if (lower.includes('pay') && (lower.includes('month') && lower.includes('then'))) {
      return {
        intent: 'payment_plan_request',
        action: 'notify_business',
        confidence: 0.8,
        reasoning: 'Customer requested payment plan',
      }
    }
    
    // Payment claimed
    if (lower.includes('already paid') || lower.includes('paid it')) {
      return {
        intent: 'payment_claimed',
        action: 'verify_payment',
        confidence: 0.75,
        reasoning: 'Customer claims payment already made',
      }
    }
    
    // Default: unknown
    return {
      intent: 'payment_processing',
      action: 'await_further_info',
      confidence: 0.5,
      reasoning: 'Response unclear, await further information',
    }
  },
  
  /**
   * Generate payment reminder message
   */
  generatePaymentReminder(invoice: {
    invoiceNumber: string
    amount: number
    dueDate: string
    customerName: string
    daysOverdue: number
  }): string {
    const { invoiceNumber, amount, dueDate, customerName, daysOverdue } = invoice
    
    if (daysOverdue <= 0) {
      return `Hi ${customerName}, just a friendly reminder that invoice #${invoiceNumber} for $${amount} is due on ${dueDate}. Thank you for your business!`
    }
    
    if (daysOverdue <= 7) {
      return `Hi ${customerName}, invoice #${invoiceNumber} for $${amount} is now ${daysOverdue} days overdue. Please let us know if you have any questions or need assistance.`
    }
    
    return `Hi ${customerName}, invoice #${invoiceNumber} for $${amount} is ${daysOverdue} days overdue. We haven't received payment yet. Please contact us to discuss payment options.`
  },
  
  /**
   * Generate sales follow-up message
   */
  generateSalesFollowup(context: {
    customerName: string
    lastInteraction: string
    productInterest?: string
  }): string {
    const { customerName, lastInteraction, productInterest } = context
    
    if (productInterest) {
      return `Hi ${customerName}, following up on your interest in ${productInterest}. Do you have any questions or would you like to proceed?`
    }
    
    return `Hi ${customerName}, following up from our last conversation on ${lastInteraction}. How can I help you today?`
  },
}
