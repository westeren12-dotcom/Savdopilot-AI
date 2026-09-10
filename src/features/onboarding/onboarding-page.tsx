import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { BUSINESS_TYPES, type BusinessType, type Product } from '@/types'
import { readSelectedProduct } from '@/lib/product-context'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input, Label, Textarea } from '@/components/ui/input'
import { actions } from '@/store/app-store'

const emptyProduct = (): Omit<Product, 'id' | 'businessId' | 'active'> => ({
  name: '',
  price: 0,
  cost: 0,
  stock: 0,
  minStock: 5,
  description: '',
  categoryId: 'Umumiy',
})

export function OnboardingPage() {
  const nav = useNavigate()
  const [step, setStep] = useState(1)
  const [type, setType] = useState<BusinessType>('restaurant')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [workingHours, setWorkingHours] = useState('09:00–21:00')
  const [telegram, setTelegram] = useState('')
  const [instagram, setInstagram] = useState('')
  const [products, setProducts] = useState([emptyProduct()])
  const [aiPersona, setAiPersona] = useState('Do‘stona, qisqa, o‘zbek tilida. Faqat haqiqiy narxlarni ayt.')
  const [aiWelcome, setAiWelcome] = useState('Assalomu alaykum! Qanday yordam bera olaman?')

  function finish() {
    actions.completeOnboarding({
      type,
      name,
      phone,
      address,
      workingHours,
      telegram,
      instagram,
      products,
      aiPersona,
      aiWelcome,
    })
    nav(readSelectedProduct() === 'invoices' ? '/app/collections' : '/app')
  }

  return (
    <div className="mesh min-h-screen px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <p className="text-sm text-muted-foreground">Qadam {step} / 4</p>
        <h1 className="font-display mt-2 text-3xl">Biznesni sozlash</h1>

        {step === 1 && (
          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            {BUSINESS_TYPES.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => setType(b.id)}
                className={`rounded-2xl border p-4 text-left ${type === b.id ? 'ring-2 ring-primary' : ''}`}
              >
                <span className="text-2xl">{b.emoji}</span>
                <p className="mt-2 text-sm font-semibold">{b.label}</p>
              </button>
            ))}
          </div>
        )}

        {step === 2 && (
          <Card className="mt-6 space-y-3">
            <Field label="Nomi">
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </Field>
            <Field label="Telefon">
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </Field>
            <Field label="Manzil">
              <Input value={address} onChange={(e) => setAddress(e.target.value)} />
            </Field>
            <Field label="Ish vaqti">
              <Input value={workingHours} onChange={(e) => setWorkingHours(e.target.value)} />
            </Field>
            <Field label="Telegram">
              <Input value={telegram} onChange={(e) => setTelegram(e.target.value)} />
            </Field>
            <Field label="Instagram">
              <Input value={instagram} onChange={(e) => setInstagram(e.target.value)} />
            </Field>
          </Card>
        )}

        {step === 3 && (
          <div className="mt-6 space-y-4">
            {products.map((p, idx) => (
              <Card key={idx} className="grid gap-2 md:grid-cols-2">
                <Input
                  placeholder="Nomi"
                  value={p.name}
                  onChange={(e) => {
                    const next = [...products]
                    next[idx] = { ...p, name: e.target.value }
                    setProducts(next)
                  }}
                />
                <Input
                  placeholder="Kategoriya"
                  value={p.categoryId}
                  onChange={(e) => {
                    const next = [...products]
                    next[idx] = { ...p, categoryId: e.target.value }
                    setProducts(next)
                  }}
                />
                <Input
                  type="number"
                  placeholder="Narx"
                  value={p.price || ''}
                  onChange={(e) => {
                    const next = [...products]
                    next[idx] = { ...p, price: Number(e.target.value) }
                    setProducts(next)
                  }}
                />
                <Input
                  type="number"
                  placeholder="Tannarx"
                  value={p.cost || ''}
                  onChange={(e) => {
                    const next = [...products]
                    next[idx] = { ...p, cost: Number(e.target.value) }
                    setProducts(next)
                  }}
                />
                <Input
                  type="number"
                  placeholder="Stock"
                  value={p.stock || ''}
                  onChange={(e) => {
                    const next = [...products]
                    next[idx] = { ...p, stock: Number(e.target.value) }
                    setProducts(next)
                  }}
                />
                <Textarea
                  placeholder="Tavsif"
                  value={p.description}
                  onChange={(e) => {
                    const next = [...products]
                    next[idx] = { ...p, description: e.target.value }
                    setProducts(next)
                  }}
                />
              </Card>
            ))}
            <Button variant="outline" onClick={() => setProducts([...products, emptyProduct()])}>
              Mahsulot qo‘shish
            </Button>
          </div>
        )}

        {step === 4 && (
          <Card className="mt-6 space-y-3">
            <Field label="AI shaxsiyati">
              <Textarea value={aiPersona} onChange={(e) => setAiPersona(e.target.value)} />
            </Field>
            <Field label="Salomlashuv">
              <Textarea value={aiWelcome} onChange={(e) => setAiWelcome(e.target.value)} />
            </Field>
          </Card>
        )}

        <div className="mt-6 flex justify-between">
          <Button variant="ghost" disabled={step === 1} onClick={() => setStep(step - 1)}>
            Orqaga
          </Button>
          {step < 4 ? (
            <Button onClick={() => setStep(step + 1)}>Keyingi</Button>
          ) : (
            <Button onClick={finish}>Dashboardga o‘tish</Button>
          )}
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      {children}
    </div>
  )
}
