import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge, Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useSession } from '@/hooks/use-session'
import { formatSom, uid } from '@/lib/utils'
import type { Product } from '@/types'

export function InventoryPage() {
  const { business, state, actions } = useSession()
  const products = state.products.filter((p) => p.businessId === business?.id)
  const [draft, setDraft] = useState<Partial<Product>>({
    name: '',
    price: 0,
    cost: 0,
    stock: 0,
    minStock: 5,
    description: '',
  })

  return (
    <div className="space-y-4">
      <h1 className="font-display text-3xl">Ombor</h1>
      <div className="grid gap-3">
        {products.map((p) => (
          <Card key={p.id} className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold">{p.name}</p>
              <p className="text-sm text-muted-foreground">
                Tannarx {formatSom(p.cost)} · Sotuv {formatSom(p.price)}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {p.stock <= p.minStock && <Badge tone="warn">⚠️ Stock tugashiga yaqin</Badge>}
              <span className="text-sm">Stock: {p.stock}</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const next = { ...p, stock: p.stock + 10 }
                  actions.upsertProduct(next)
                  toast.success('Stock yangilandi')
                }}
              >
                +10
              </Button>
            </div>
          </Card>
        ))}
      </div>
      <Card className="grid gap-2 md:grid-cols-3">
        <Input
          placeholder="Yangi mahsulot"
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
        />
        <Input
          type="number"
          placeholder="Narx"
          onChange={(e) => setDraft({ ...draft, price: Number(e.target.value) })}
        />
        <Button
          onClick={() => {
            if (!business || !draft.name) return
            actions.upsertProduct({
              id: uid('prd'),
              businessId: business.id,
              categoryId: state.categories[0]?.id ?? 'cat_new',
              name: draft.name,
              price: draft.price ?? 0,
              cost: draft.cost ?? 0,
              stock: draft.stock ?? 0,
              minStock: draft.minStock ?? 5,
              description: draft.description ?? '',
              active: true,
            })
            setDraft({ name: '', price: 0, cost: 0, stock: 0, minStock: 5, description: '' })
          }}
        >
          Qo‘shish
        </Button>
      </Card>
    </div>
  )
}
