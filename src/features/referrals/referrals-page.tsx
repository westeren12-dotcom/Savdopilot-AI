import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/card'
import { useSession } from '@/hooks/use-session'
import { Copy, Share2, Users, Gift, Calendar } from 'lucide-react'
import { toast } from 'sonner'

export function ReferralsPage() {
  const { profile, state } = useSession()
  const referrals = state.referrals.filter((r) => r.ownerUserId === profile?.id)
  const successfulReferrals = referrals.filter((r) => r.status === 'success')
  const totalBonusDays = successfulReferrals.reduce((sum, r) => sum + r.bonusDays, 0)

  function copyReferralCode() {
    if (!profile?.referralCode) return
    navigator.clipboard.writeText(profile.referralCode)
    toast.success('Kod nusxalandi')
  }

  function copyReferralLink() {
    if (!profile?.referralCode) return
    const link = `${window.location.origin}/register?ref=${profile.referralCode}`
    navigator.clipboard.writeText(link)
    toast.success('Havola nusxalandi')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl">Referral</h1>
        <p className="text-muted-foreground">Do‘stlaringizni taklif qiling, bonus kuling</p>
      </div>

      {/* Referral code card */}
      <Card className="p-6">
        <div className="flex items-center gap-4">
          <div className="rounded-full bg-primary/10 p-3">
            <Gift className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold">Sizning referral kodingiz</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Do‘stlaringiz bu kod bilan ro‘yxatdan o‘tsa, sizga +15 kun bonus beriladi
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-lg bg-muted p-3">
            <p className="text-xs text-muted-foreground">Referral kod</p>
            <div className="flex items-center gap-2 mt-1">
              <p className="font-display text-lg">{profile?.referralCode || '—'}</p>
              <Button size="sm" variant="ghost" onClick={copyReferralCode}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="rounded-lg bg-muted p-3">
            <p className="text-xs text-muted-foreground">Referral havola</p>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-sm truncate">
                {profile?.referralCode ? `${window.location.origin}/register?ref=${profile.referralCode}` : '—'}
              </p>
              <Button size="sm" variant="ghost" onClick={copyReferralLink}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <Button className="flex-1" onClick={copyReferralLink}>
            <Share2 className="mr-2 h-4 w-4" />
            Havolani ulashish
          </Button>
        </div>
      </Card>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <p className="text-sm text-muted-foreground">Taklif qilingan</p>
          </div>
          <p className="mt-2 font-display text-2xl">{referrals.length}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-green-500" />
            <p className="text-sm text-muted-foreground">Muvaffaqiyatli</p>
          </div>
          <p className="mt-2 font-display text-2xl">{successfulReferrals.length}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            <p className="text-sm text-muted-foreground">Bonus kunlar</p>
          </div>
          <p className="mt-2 font-display text-2xl">+{totalBonusDays}</p>
        </Card>
      </div>

      {/* Referral list */}
      <Card>
        <h2 className="p-4 font-semibold">Referral tarixi</h2>
        <div className="divide-y">
          {referrals.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              Hali referral yo‘q. Havolani do‘stlaringizga yuboring!
            </p>
          ) : (
            referrals.map((referral) => (
              <div key={referral.id} className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium">{referral.invitedEmail}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(referral.createdAt).toLocaleDateString('uz-UZ')}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {referral.status === 'success' ? (
                    <Badge tone="gold">+{referral.bonusDays} kun</Badge>
                  ) : (
                    <Badge tone="muted">Kutilmoqda</Badge>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* How it works */}
      <Card className="p-6">
        <h2 className="font-semibold mb-4">Qanday ishlaydi?</h2>
        <div className="space-y-3 text-sm text-muted-foreground">
          <div className="flex items-start gap-3">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
              1
            </div>
            <p>Do‘stlaringizga referral kod yoki havolani yuboring</p>
          </div>
          <div className="flex items-start gap-3">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
              2
            </div>
            <p>Ular kod bilan ro‘yxatdan o‘tadi</p>
          </div>
          <div className="flex items-start gap-3">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
              3
            </div>
            <p>Sizga +15 kun, ularga ham +15 kun bonus beriladi</p>
          </div>
        </div>
      </Card>
    </div>
  )
}