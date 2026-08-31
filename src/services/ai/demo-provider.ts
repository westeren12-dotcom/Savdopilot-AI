import type { AiChatRequest, AiChatResult, AiProvider } from './types'

const UNKNOWN =
  'Bu ma’lumotni biznes egasidan aniqlab berishimiz kerak.'

function normalize(text: string): string {
  return text.toLowerCase().replace(/[’‘ʻ`]/g, "'")
}

function findProduct(products: AiChatRequest['context']['products'], text: string) {
  const n = normalize(text)
  return products.find((p) => n.includes(p.name.toLowerCase()))
}

export const demoAiProvider: AiProvider = {
  async chat(request) {
    const last = request.messages.at(-1)?.content ?? ''
    const { business, products } = request.context
    const n = normalize(last)
    const result: AiChatResult = { text: '' }

    if (/(salom|assalom|hello|hi)/.test(n)) {
      result.text =
        business.aiWelcome ||
        `Assalomu alaykum! ${business.name}ga xush kelibsiz. Qanday yordam bera olaman?`
      return result
    }

    if (/(ish vaqt|soat|ochiq)/.test(n)) {
      result.text = business.workingHours
        ? `Ish vaqtimiz: ${business.workingHours}.`
        : UNKNOWN
      return result
    }

    if (/(manzil|qayerda|address)/.test(n)) {
      result.text = business.address
        ? `Manzilimiz: ${business.address}.`
        : UNKNOWN
      return result
    }

    if (/(telegram)/.test(n)) {
      result.text = business.telegram
        ? `Telegram: ${business.telegram}`
        : UNKNOWN
      return result
    }

    const product = findProduct(products, last)
    if (product && /(narx|qancha|price)/.test(n)) {
      result.text = `${product.name} narxi ${product.price.toLocaleString('uz-UZ')} so‘m.`
      return result
    }

    if (product && /(bor|mavjud|stock|qoldiq)/.test(n)) {
      result.text =
        product.stock > 0
          ? `${product.name} omborda ${product.stock} ta bor.`
          : `${product.name} hozircha tugagan.`
      return result
    }

    if (product) {
      result.text = `${product.name}: ${product.description} Narxi ${product.price.toLocaleString('uz-UZ')} so‘m.`
      return result
    }

    if (/(menu|mahsulot|nima bor|xizmat)/.test(n)) {
      if (!products.length) {
        result.text = UNKNOWN
        return result
      }
      result.text = `Bizda: ${products.map((p) => `${p.name} (${p.price.toLocaleString('uz-UZ')} so‘m)`).join(', ')}.`
      return result
    }

    const qtyMatch = n.match(/(\d+)\s*(ta|dona)?/)
    if (/(buyurtma|zakaz|olmoq|olasiz)/.test(n)) {
      const named = products.find((p) => n.includes(p.name.toLowerCase()))
      if (!named) {
        result.text = `Qaysi mahsulotni buyurtma qilasiz? ${products.map((p) => p.name).join(', ')}.`
        return result
      }
      result.createdOrder = {
        productName: named.name,
        quantity: qtyMatch ? Number(qtyMatch[1]) : 1,
      }
      result.text = `${named.name} uchun buyurtma qabul qilindi. Ismingiz va telefon raqamingizni yozing — tasdiqlaymiz.`
      return result
    }

    if (/(bron|booking|yozilmoq)/.test(n)) {
      result.text = `Bron uchun ism, telefon va qulay vaqtni yozing. Ish vaqti: ${business.workingHours || UNKNOWN}`
      return result
    }

    result.text = UNKNOWN
    return result
  },
}
