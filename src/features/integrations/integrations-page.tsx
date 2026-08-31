import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { useSession } from '@/hooks/use-session'
import { actions } from '@/store/app-store'
import { toast } from 'sonner'
import { CheckCircle, XCircle, Send, MessageCircle } from 'lucide-react'

export function IntegrationsPage() {
  const { business, state } = useSession()
  const [telegramToken, setTelegramToken] = useState('')
  const [connecting, setConnecting] = useState(false)

  const telegramIntegration = state.integrations.find(
    (i) => i.businessId === business?.id && i.provider === 'telegram',
  )
  const instagramIntegration = state.integrations.find(
    (i) => i.businessId === business?.id && i.provider === 'instagram',
  )

  async function handleConnectTelegram() {
    if (!telegramToken) {
      toast.error('Bot tokenini kiriting')
      return
    }
    setConnecting(true)
    try {
      await actions.connectTelegram(telegramToken)
      toast.success('Telegram ulandi')
      setTelegramToken('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xatolik')
    } finally {
      setConnecting(false)
    }
  }

  async function handleDisconnectTelegram() {
    try {
      actions.disconnectTelegram()
      toast.success('Telegram uzildi')
    } catch (err) {
      toast.error('Xatolik')
    }
  }

  async function handleConnectInstagram() {
    try {
      await actions.connectInstagram()
      toast.success('Instagram ulandi (demo)')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xatolik')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl">Integratsiyalar</h1>
        <p className="text-muted-foreground">{business?.name}</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-blue-500/10 p-3">
              <Send className="h-6 w-6 text-blue-500" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold">Telegram</h3>
              <p className="text-sm text-muted-foreground">
                AI-Sotuvchi mijozlaringizga Telegram orqali javob beradi
              </p>
            </div>
            {telegramIntegration?.status === 'connected' ? (
              <CheckCircle className="h-5 w-5 text-green-500" />
            ) : (
              <XCircle className="h-5 w-5 text-muted-foreground" />
            )}
          </div>

          {telegramIntegration?.status === 'connected' ? (
            <div className="mt-4 space-y-3">
              <div className="rounded-lg bg-muted p-3">
                <p className="text-sm font-medium">@{telegramIntegration.botUsername}</p>
                <p className="text-xs text-muted-foreground">Bot ulangan</p>
              </div>
              <Button variant="outline" className="w-full" onClick={handleDisconnectTelegram}>
                Uzish
              </Button>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              <div className="space-y-1.5">
                <Label>Bot token</Label>
                <Input
                  placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
                  value={telegramToken}
                  onChange={(e) => setTelegramToken(e.target.value)}
                />
              </div>
              <Button
                className="w-full"
                onClick={handleConnectTelegram}
                disabled={connecting}
              >
                {connecting ? 'Ulanmoqda...' : 'Ulash'}
              </Button>
              <p className="text-xs text-muted-foreground">
                @BotFather dan token oling. Webhook avtomatik o‘rnatiladi.
              </p>
            </div>
          )}
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-pink-500/10 p-3">
              <MessageCircle className="h-6 w-6 text-pink-500" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold">Instagram</h3>
              <p className="text-sm text-muted-foreground">
                AI-Sotuvchi Instagram DM orqali ishlaydi
              </p>
            </div>
            {instagramIntegration?.status === 'connected' ? (
              <CheckCircle className="h-5 w-5 text-green-500" />
            ) : (
              <XCircle className="h-5 w-5 text-muted-foreground" />
            )}
          </div>

          {instagramIntegration?.status === 'connected' ? (
            <div className="mt-4">
              <div className="rounded-lg bg-muted p-3">
                <p className="text-sm font-medium">Instagram Business ulangan</p>
                <p className="text-xs text-muted-foreground">DM avtomatik javob beradi</p>
              </div>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              <Button className="w-full" onClick={handleConnectInstagram}>
                Ulash (demo)
              </Button>
              <p className="text-xs text-muted-foreground">
                Meta API orqali Instagram Business account ulash.
              </p>
            </div>
          )}
        </Card>
      </div>

      <Card className="p-6">
        <h2 className="font-semibold">Qanday ishlaydi?</h2>
        <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
          <li>• Integratsiyalangan platformadagi xabarlar AI-ga keladi</li>
          <li>• AI biznes ma'lumotlari asosida javob beradi</li>
          <li>• Buyurtma qabul qilinganda CRMga yoziladi</li>
          <li>• Admin paneldan barcha suhbatlarni ko‘rish mumkin</li>
        </ul>
      </Card>
    </div>
  )
}