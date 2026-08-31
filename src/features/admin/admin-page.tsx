import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { useSession } from '@/hooks/use-session'
import { actions } from '@/store/app-store'
import { toast } from 'sonner'
import { Users, Building2, CreditCard, TrendingUp, Settings, CheckCircle, Ban } from 'lucide-react'
import { PLAN_LIMITS, type PlanCode } from '@/config/plans'
import { formatSom } from '@/lib/utils'

export function AdminPage() {
  const { state } = useSession()
  const [selectedBusinessId, setSelectedBusinessId] = useState<string | null>(null)
  const [newPlan, setNewPlan] = useState<PlanCode>('free')
  const [aiLimit, setAiLimit] = useState(PLAN_LIMITS.free.aiMessages)

  const selectedBusiness = state.businesses.find((b) => b.id === selectedBusinessId)
  const businessSub = state.subscriptions.find((s) => s.businessId === selectedBusinessId)

  function handleSetPlan() {
    if (!selectedBusinessId) return
    actions.adminSetPlan(selectedBusinessId, newPlan)
    toast.success('Plan o‘zgartirildi')
  }

  function handleBlockUser(userId: string) {
    const profile = state.profiles.find((p) => p.id === userId)
    if (!profile) return
    // This would need to be implemented in the store
    toast.success('User bloklandi (demo)')
  }

  function handleUnblockUser(userId: string) {
    const profile = state.profiles.find((p) => p.id === userId)
    if (!profile) return
    // This would need to be implemented in the store
    toast.success('User blokdan olindi (demo)')
  }

  const stats = {
    users: state.profiles.length,
    businesses: state.businesses.length,
    subscriptions: state.subscriptions.length,
    totalRevenue: state.payments
      .filter((p) => p.status === 'paid')
      .reduce((sum, p) => sum + p.amount, 0),
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl">Super Admin Panel</h1>
        <p className="text-muted-foreground">Platformani boshqarish</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <p className="text-sm text-muted-foreground">Foydalanuvchilar</p>
          </div>
          <p className="mt-2 font-display text-2xl">{stats.users}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <p className="text-sm text-muted-foreground">Bizneslar</p>
          </div>
          <p className="mt-2 font-display text-2xl">{stats.businesses}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            <p className="text-sm text-muted-foreground">Obunalar</p>
          </div>
          <p className="mt-2 font-display text-2xl">{stats.subscriptions}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-green-500" />
            <p className="text-sm text-muted-foreground">Jami daromad</p>
          </div>
          <p className="mt-2 font-display text-2xl">{formatSom(stats.totalRevenue)}</p>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Businesses */}
        <Card>
          <h2 className="p-4 font-semibold">Bizneslar</h2>
          <div className="divide-y max-h-96 overflow-y-auto">
            {state.businesses.map((business) => (
              <div
                key={business.id}
                className={`p-4 cursor-pointer hover:bg-muted ${
                  selectedBusinessId === business.id ? 'bg-muted' : ''
                }`}
                onClick={() => setSelectedBusinessId(business.id)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{business.name}</p>
                    <p className="text-xs text-muted-foreground">{business.type}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">
                      {businessSub?.planCode.toUpperCase()}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(business.createdAt).toLocaleDateString('uz-UZ')}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Business details */}
        {selectedBusiness && (
          <Card className="p-4">
            <h2 className="font-semibold mb-4">{selectedBusiness.name}</h2>
            <div className="space-y-4">
              <div>
                <Label>Joriy plan</Label>
                <p className="font-display text-xl mt-1">
                  {businessSub?.planCode.toUpperCase()}
                </p>
              </div>

              <div className="space-y-1.5">
                <Label>Planni o‘zgartirish</Label>
                <select
                  className="flex h-10 w-full rounded-xl border bg-card px-3 text-sm outline-none ring-ring focus:ring-2"
                  value={newPlan}
                  onChange={(e) => setNewPlan(e.target.value as PlanCode)}
                >
                  <option value="free">Free</option>
                  <option value="pro">Pro</option>
                  <option value="premium">Premium</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label>AI limit (oyiga)</Label>
                <Input
                  type="number"
                  value={aiLimit}
                  onChange={(e) => setAiLimit(Number(e.target.value))}
                />
              </div>

              <Button className="w-full" onClick={handleSetPlan}>
                <Settings className="mr-2 h-4 w-4" />
                Planni o‘zgartirish
              </Button>

              <div className="pt-4 border-t">
                <h3 className="font-semibold mb-2">Biznes ma'lumotlari</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Telefon:</span>
                    <span>{selectedBusiness.phone || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Manzil:</span>
                    <span>{selectedBusiness.address || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Ish vaqti:</span>
                    <span>{selectedBusiness.workingHours}</span>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* Users */}
      <Card>
        <h2 className="p-4 font-semibold">Foydalanuvchilar</h2>
        <div className="divide-y max-h-96 overflow-y-auto">
          {state.profiles.map((profile) => (
            <div key={profile.id} className="flex items-center justify-between p-4">
              <div>
                <p className="font-medium">{profile.fullName}</p>
                <p className="text-xs text-muted-foreground">{profile.email}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs bg-muted px-2 py-0.5 rounded">
                    {profile.role}
                  </span>
                  {profile.blocked && (
                    <span className="text-xs bg-red-500/10 text-red-500 px-2 py-0.5 rounded">
                      Bloklangan
                    </span>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                {profile.blocked ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleUnblockUser(profile.id)}
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Blokdan olish
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleBlockUser(profile.id)}
                  >
                    <Ban className="h-4 w-4 mr-1" />
                    Bloklash
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}