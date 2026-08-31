import type { AiChatRequest, AiChatResult, AiProvider } from './types'

/**
 * Production path: the browser never holds the model API key.
 * It calls a Supabase Edge Function which talks to the provider.
 */
export const edgeAiProvider: AiProvider = {
  async chat(request: AiChatRequest): Promise<AiChatResult> {
    const { env } = await import('@/config/env')
    const { getSupabase } = await import('@/lib/supabase')
    const supabase = getSupabase()
    if (!supabase) {
      throw new Error('Supabase sozlanmagan. .env dagi VITE_SUPABASE_* ni to‘ldiring.')
    }

    const { data, error } = await supabase.functions.invoke('ai-chat', {
      body: {
        messages: request.messages,
        businessId: request.context.business.id,
        appUrl: env.appUrl,
      },
    })

    if (error) throw error
    return data as AiChatResult
  },
}
