import type { IntegrationStatus } from '@/types'

export interface InstagramService {
  connectOAuth(): Promise<{ status: IntegrationStatus }>
  disconnect(): Promise<void>
}

/**
 * MVP mock. Later: Meta OAuth → long-lived page token → webhook for DMs.
 * Do not put META_APP_SECRET in the frontend.
 */
export const instagramService: InstagramService = {
  async connectOAuth() {
    return { status: 'connected' }
  },
  async disconnect() {
    return
  },
}
