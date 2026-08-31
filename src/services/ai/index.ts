import { env } from '@/config/env'
import { demoAiProvider } from './demo-provider'
import { edgeAiProvider } from './edge-provider'
import type { AiProvider } from './types'

export function getAiProvider(): AiProvider {
  return env.useDemoMode ? demoAiProvider : edgeAiProvider
}

export type { AiChatRequest, AiChatResult, AiProvider } from './types'
