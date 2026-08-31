import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useSession } from '@/hooks/use-session'
import { Mic, Headphones, Sparkles } from 'lucide-react'
import { PLAN_PRICES } from '@/config/plans'

export function VoicePage() {
  const { business, state } = useSession()
  const sub = state.subscriptions.find((s) => s.businessId === business?.id)
  const isPremium = sub?.planCode === 'premium'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl">Voice AI</h1>
        <p className="text-muted-foreground">{business?.name}</p>
      </div>

      {!isPremium ? (
        <Card className="border-accent bg-accent/5 p-6">
          <div className="flex items-center gap-4">
            <div className="rounded-full bg-primary/10 p-3">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold">Premium funksiya</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Voice AI faqat Premium tarifda mavjud. Mijozlar ovozli xabar yuborsa, AI javob beradi.
              </p>
            </div>
            <Button asChild>
              <a href="/app/billing">Upgrade qilish ({formatSom(PLAN_PRICES.premium)}/oy)</a>
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="rounded-full bg-green-500/10 p-3">
              <Mic className="h-6 w-6 text-green-500" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold">Voice AI faol</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Mijozlar ovozli xabar yuborsa, AI avtomatik javob beradi.
              </p>
            </div>
            <div className="flex items-center gap-2 text-green-500">
              <Mic className="h-4 w-4" />
              <span className="text-sm font-medium">Active</span>
            </div>
          </div>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <Mic className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Speech-to-Text</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Mijozning ovozli xabari matnga o‘giriladi va AI tahlil qiladi.
          </p>
          <div className="mt-4 rounded-lg bg-muted p-3">
            <p className="text-xs text-muted-foreground">Kiritilgan ovoz:</p>
            <p className="text-sm">"2 ta pepperoni pizza buyurtma qilaman"</p>
          </div>
          <div className="mt-2 rounded-lg bg-primary/10 p-3">
            <p className="text-xs text-muted-foreground">AI tushunildi:</p>
            <p className="text-sm">Mahsulot: Pepperoni pizza, Miqdor: 2</p>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <Headphones className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Text-to-Speech</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            AI javobi ovozli xabar sifatida yuboriladi (ixtiyoriy).
          </p>
          <div className="mt-4 rounded-lg bg-muted p-3">
            <p className="text-xs text-muted-foreground">AI javobi:</p>
            <p className="text-sm">"Buyurtmangiz qabul qilindi. 15-20 daqiqada yetkazib beriladi."</p>
          </div>
          <div className="mt-2 rounded-lg bg-primary/10 p-3">
            <p className="text-xs text-muted-foreground">Ovozli javob:</p>
            <p className="text-sm">🔊 Play</p>
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <h2 className="font-semibold">Qanday ishlaydi?</h2>
        <div className="mt-4 space-y-3">
          <div className="flex items-start gap-3">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
              1
            </div>
            <div>
              <p className="font-medium">Mijoz ovozli xabar yuboradi</p>
              <p className="text-sm text-muted-foreground">Telegram yoki Instagram orqali</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
              2
            </div>
            <div>
              <p className="font-medium">Speech-to-Text</p>
              <p className="text-sm text-muted-foreground">Ovoz matnga o‘giriladi</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
              3
            </div>
            <div>
              <p className="font-medium">AI tahlil qiladi</p>
              <p className="text-sm text-muted-foreground">Biznes ma'lumotlari asosida</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
              4
            </div>
            <div>
              <p className="font-medium">Javob beriladi</p>
              <p className="text-sm text-muted-foreground">Matn yoki ovozli xabar sifatida</p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}

function formatSom(amount: number): string {
  return amount.toLocaleString('uz-UZ')
}