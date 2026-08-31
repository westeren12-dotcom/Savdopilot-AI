import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Label, Textarea } from '@/components/ui/input'
import { useSession } from '@/hooks/use-session'
import { actions } from '@/store/app-store'
import { toast } from 'sonner'
import { Save, Building2, Phone, MapPin, Clock, MessageCircle, Bot } from 'lucide-react'

export function SettingsPage() {
  const { business } = useSession()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: business?.name || '',
    phone: business?.phone || '',
    address: business?.address || '',
    workingHours: business?.workingHours || '',
    telegram: business?.telegram || '',
    instagram: business?.instagram || '',
    aiPersona: business?.aiPersona || '',
    aiWelcome: business?.aiWelcome || '',
  })

  async function handleSave() {
    if (!business) return
    setLoading(true)
    try {
      actions.updateSettings(formData)
      toast.success('Sozlamalar saqlandi')
    } catch (err) {
      toast.error('Xatolik')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl">Sozlamalar</h1>
        <p className="text-muted-foreground">{business?.name}</p>
      </div>

      <Card className="p-6">
        <h2 className="font-semibold mb-4">Biznes ma'lumotlari</h2>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Biznes nomi</Label>
            <div className="relative">
              <Building2 className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-10"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Telefon</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-10"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Ish vaqti</Label>
              <div className="relative">
                <Clock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-10"
                  placeholder="09:00–21:00"
                  value={formData.workingHours}
                  onChange={(e) => setFormData({ ...formData, workingHours: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Manzil</Label>
            <div className="relative">
              <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-10"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Telegram</Label>
              <div className="relative">
                <MessageCircle className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-10"
                  placeholder="@username"
                  value={formData.telegram}
                  onChange={(e) => setFormData({ ...formData, telegram: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Instagram</Label>
              <div className="relative">
                <MessageCircle className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-10"
                  placeholder="@username"
                  value={formData.instagram}
                  onChange={(e) => setFormData({ ...formData, instagram: e.target.value })}
                />
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="font-semibold mb-4">AI-Sotuvchi sozlamalari</h2>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>AI shaxsiyati</Label>
            <div className="relative">
              <Bot className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Textarea
                className="pl-10 min-h-24"
                placeholder="Do‘stona, qisqa, o‘zbek tilida. Faqat haqiqiy narxlarni ayt."
                value={formData.aiPersona}
                onChange={(e) => setFormData({ ...formData, aiPersona: e.target.value })}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              AI qanday uslubda javob berishini belgilang
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Salomlashuv xabari</Label>
            <Textarea
              placeholder="Assalomu alaykum! Qanday yordam bera olaman?"
              value={formData.aiWelcome}
              onChange={(e) => setFormData({ ...formData, aiWelcome: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Mijoz birinchi marta yozganda AI shu xabarni yuboradi
            </p>
          </div>
        </div>
      </Card>

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => setFormData({
          name: business?.name || '',
          phone: business?.phone || '',
          address: business?.address || '',
          workingHours: business?.workingHours || '',
          telegram: business?.telegram || '',
          instagram: business?.instagram || '',
          aiPersona: business?.aiPersona || '',
          aiWelcome: business?.aiWelcome || '',
        })}>
          Bekor qilish
        </Button>
        <Button onClick={handleSave} disabled={loading}>
          <Save className="mr-2 h-4 w-4" />
          {loading ? 'Saqlanmoqda...' : 'Saqlash'}
        </Button>
      </div>
    </div>
  )
}