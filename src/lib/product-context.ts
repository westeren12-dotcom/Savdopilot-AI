// Product direction chosen on the homepage. Survives auth redirects (localStorage +
// sessionStorage for the Google popup window handoff) so the selection made before
// authentication is never lost.
export type ProductType = 'sales' | 'invoices'

const KEY = 'savdopilot.selectedProduct'
const SESSION_KEY = 'savdopilot.pendingProduct'

function isProduct(v: unknown): v is ProductType {
  return v === 'sales' || v === 'invoices'
}

export function readSelectedProduct(): ProductType | null {
  try {
    const v = localStorage.getItem(KEY)
    return isProduct(v) ? v : null
  } catch {
    return null
  }
}

export function writeSelectedProduct(p: ProductType | null) {
  try {
    if (p) localStorage.setItem(KEY, p)
    else localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}

// Mirror in sessionStorage for the OAuth popup flow: the popup runs in the same
// origin, so after getRedirectResult-style resolution we can restore the context.
export function stashPendingProduct(p: ProductType) {
  try {
    sessionStorage.setItem(SESSION_KEY, p)
  } catch {
    /* ignore */
  }
}

export function takePendingProduct(): ProductType | null {
  try {
    const v = sessionStorage.getItem(SESSION_KEY)
    if (isProduct(v)) {
      sessionStorage.removeItem(SESSION_KEY)
      return v
    }
  } catch {
    /* ignore */
  }
  return readSelectedProduct()
}

/** Validate a raw ?product= query param. */
export function parseProduct(v: string | null | undefined): ProductType | null {
  return isProduct(v) ? v : null
}

export const PRODUCT_LABELS: Record<ProductType, string> = {
  sales: 'AI Sales',
  invoices: 'Invoices & Collections',
}
