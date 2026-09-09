import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  Bot,
  Check,
  ChevronDown,
  Mic,
  Package,
  Shield,
  Sparkles,
  Store,
  Wallet,
  User,
  CheckCircle,
  Globe,
  DollarSign,
  FileText,
  TrendingUp,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { FEATURES, PLAN_PRICES } from '@/config/plans'
import { formatSom, cn } from '@/lib/utils'
import { useState } from 'react'

type Language = 'en' | 'ru' | 'uz'

const content = {
  en: {
    badge: "AI-Powered Business Platform",
    headline: "Sell more. Manage customers. Get paid faster.",
    subheading: "AventryX AI helps you automate sales, manage customer relationships, and collect payments — all in one platform.",
    ctaPrimary: "Start Free",
    ctaSecondary: "Watch Demo",
    automateQuestion: "What would you like to automate?",
    aiSales: {
      title: "AI Sales",
      subtitle: "Find customers, manage leads, automate follow-ups, and increase sales.",
      features: ["AI Sales Assistant", "Lead Management", "Customer Management", "Sales Follow-ups", "Orders", "Sales Analytics"],
      workflow: "Lead → Customer → Conversation → Order → Sale",
    },
    invoices: {
      title: "Invoices & Collections",
      subtitle: "Track invoices, automate payment reminders, and get paid faster.",
      features: ["Invoice Manager", "Due-date Tracking", "Paid / Unpaid / Overdue", "AI Payment Reminders", "AI Response Understanding", "Payment Promise Tracking", "Collections Dashboard"],
      workflow: "Invoice → Due Date → AI Follow-up → Customer Response → Payment",
    },
    dashboard: {
      sales: { newLeads: 38, orders: 24, sales: "$4,820" },
      collections: { outstanding: "$18,400", overdue: "$6,200", recovered: "$3,800" },
    },
    chat: {
      customer1: "Looking for a 3-bedroom apartment in Chilonzor",
      ai1: "We have 3-bedroom options in Chilonzor. What's your budget range?",
      customer2: "Around $40,000-50,000",
      ai2: "📍 Chilonzor-9, 3rd floor, 78m² — $45,000. Should I schedule a viewing for tomorrow at 3 PM?",
      customer3: "Sure, go ahead",
      success1: "Viewing confirmed — tomorrow 3:00 PM",
      success2: "Customer added to CRM",
    },
    testimonials: [
      { name: 'Malika, online shop', text: 'Orders are accepted even at night. I confirm them in the morning.' },
      { name: 'Sardor, barbershop', text: 'Bookings are collected in Telegram. Every customer is visible in CRM.' },
      { name: 'Nodira, education center', text: 'Prices and class times are mentioned exactly as we wrote — no confusion.' },
    ],
  },
  ru: {
    badge: "AI-платформа для бизнеса",
    headline: "Продавайте больше. Управляйте клиентами. Получайте оплату быстрее.",
    subheading: "AventryX AI помогает автоматизировать продажи, управлять клиентами и собирать платежи — всё в одной платформе.",
    ctaPrimary: "Начать бесплатно",
    ctaSecondary: "Смотреть демо",
    automateQuestion: "Что вы хотите автоматизировать?",
    aiSales: {
      title: "AI Продажи",
      subtitle: "Находите клиентов, управляйте лидами, автоматизируйтеFollow-ups и увеличивайте продажи.",
      features: ["AI Ассистент продаж", "Управление лидами", "Управление клиентами", "Follow-ups продаж", "Заказы", "Аналитика продаж"],
      workflow: "Лид → Клиент → Разговор → Заказ → Продажа",
    },
    invoices: {
      title: "Счета и Кollections",
      subtitle: "Отслеживайте счета, автоматизируйте напоминания об оплате и получайте оплату быстрее.",
      features: ["Менеджер счетов", "Отслеживание сроков", "Оплачено / Неоплачено / Просрочено", "AI Напоминания об оплате", "AI Понимание ответов", "Отслеживание обещаний оплаты", "Dashboard Collections"],
      workflow: "Счет → Срок оплаты → AI Follow-up → Ответ клиента → Оплата",
    },
    dashboard: {
      sales: { newLeads: 38, orders: 24, sales: "$4,820" },
      collections: { outstanding: "$18,400", overdue: "$6,200", recovered: "$3,800" },
    },
    chat: {
      customer1: "Нужна 3-комнатная квартира в Чиланзаре",
      ai1: "У нас есть 3-комнатные варианты в Чиланзаре. Какой у вас бюджет?",
      customer2: "Примерно 40-50 тысяч долларов",
      ai2: "📍 Чиланзар-9, 3-й этаж, 78м² — $45,000. Записать вас на просмотр завтра в 15:00?",
      customer3: "Да, конечно, запишите",
      success1: "Просмотр подтверждён — завтра в 15:00",
      success2: "Клиент добавлен в CRM",
    },
    testimonials: [
      { name: 'Малика, онлайн магазин', text: 'Заказы принимаются даже ночью. Я подтверждаю их утром.' },
      { name: 'Сардор, барбершоп', text: 'Бронирования собираются в Telegram. Каждый клиент виден в CRM.' },
      { name: 'Нодира, учебный центр', text: 'Цены и время занятий указаны так, как мы написали — нет путаницы.' },
    ],
  },
  uz: {
    badge: "AI-Powered Business Platform",
    headline: "Ko'proq savdo qiling. Mijozlarni boshqaring. To'lovni tez oling.",
    subheading: "AventryX AI savdolarni avtomatlashtirishga, mijozlarni boshqarishga va to'lovlarni yig'ishga yordam beradi — bitta platformada.",
    ctaPrimary: "Bepul boshlash",
    ctaSecondary: "Demo ko'rish",
    automateQuestion: "Nimani avtomatlashtirmoqchisiz?",
    aiSales: {
      title: "AI Savdo",
      subtitle: "Mijozlarni toping, leadlarni boshqaring, follow-up'larni avtomatlashtiring va savdolarni oshiring.",
      features: ["AI Savdo Assistenti", "Lead Boshqaruvi", "Mijoz Boshqaruvi", "Savdo Follow-up'lari", "Buyurtmalar", "Savdo Analitikasi"],
      workflow: "Lead → Mijoz → Suhbat → Buyurtma → Savdo",
    },
    invoices: {
      title: "Invoicelar va Collections",
      subtitle: "Invoicelarni kuzating, to'lov eslatmalarini avtomatlashtiring va tezroq to'lov oling.",
      features: ["Invoice Menjeri", "Due-date Tracking", "To'langan / To'lanmagan / Overdue", "AI To'lov Eslatmalari", "AI Javob Tushunish", "To'lov Va'dalari Tracking", "Collections Dashboard"],
      workflow: "Invoice → Due Date → AI Follow-up → Mijoz Javobi → To'lov",
    },
    dashboard: {
      sales: { newLeads: 38, orders: 24, sales: "$4,820" },
      collections: { outstanding: "$18,400", overdue: "$6,200", recovered: "$3,800" },
    },
    chat: {
      customer1: "3 xonali kvartira kerak edi, Chilonzorda",
      ai1: "Chilonzor tumanida 3 xonali variantlarimiz bor. Byudjetingiz taxminan qancha?",
      customer2: "40-50 ming dollar atrofida",
      ai2: "📍 Chilonzor-9, 3-qavat, 78m² — $45,000. Ertaga soat 15:00 ga ko'rishga yozib qo'yaymi?",
      customer3: "Albatta, yozib qo'ying",
      success1: "Ko'rish tasdiqlandi — ertaga 15:00",
      success2: "Mijoz CRMga qo'shildi",
    },
    testimonials: [
      { name: 'Malika, online shop', text: 'Kechasi ham buyurtmalar qabul qilinadi. Men ertalab tasdiqlayman.' },
      { name: 'Sardor, barbershop', text: 'Bronlar Telegramda yig‘iladi. CRM’da har bir mijoz ko‘rinadi.' },
      { name: 'Nodira, o‘quv markazi', text: 'Narx va dars vaqti faqat biz yozganidek aytiladi — chalkashlik yo‘q.' },
    ],
  },
}

const faqs = [
  {
    q: 'AI o‘zi narx o‘ylab topadimi?',
    a: 'Yo‘q. AI faqat siz kiritgan mahsulot, narx va biznes ma’lumotlaridan foydalanadi. Topilmasa, xavfsiz javob beradi.',
  },
  {
    q: 'Telegram qanday ulanadi?',
    a: 'Bot tokenini sozlamalarga kiritasiz. Webhook o‘rnatiladi, xabarlar AI orqali javoblanadi va buyurtma/CRM yoziladi.',
  },
  {
    q: 'To‘lov Click/Payme ishlaydimi?',
    a: 'To‘lov qatlami tayyor. Hozircha mock provider, keyin Click, Payme, Uzum va Stripe ulanadi.',
  },
  {
    q: 'Demo rejim nima?',
    a: 'VITE_USE_DEMO_MODE=true bo‘lsa, fake biznes va AI javoblari bilan to‘liq oqimni sinaysiz.',
  },
]

export function LandingPage() {
  const [language, setLanguage] = useState<Language>('uz')
  const t = content[language]
  return (
    <div className="mesh min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
        <Link to="/" className="font-display text-xl">
          AventryX AI
        </Link>
        <div className="flex items-center gap-2">
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="relative"
          >
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLanguage(language === 'en' ? 'ru' : language === 'ru' ? 'uz' : 'en')}
              className="flex items-center gap-2"
            >
              <Globe className="h-4 w-4" />
              {language.toUpperCase()}
            </Button>
          </motion.div>
          <Button variant="ghost" asChild>
            <Link to="/login">Kirish</Link>
          </Button>
          <Button asChild>
            <Link to="/register">7 kun bepul</Link>
          </Button>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 pb-32 pt-20">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16 items-center">
          {/* Left side - Content */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-2xl"
          >
            <div className="mb-6 inline-flex items-center rounded-full border border-input bg-background px-3 py-1 text-sm">
              <Sparkles className="h-3 w-3 mr-2 text-primary" />
              {t.badge}
            </div>

            <h1 className="font-display text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-semibold leading-tight tracking-tight">
              <motion.span
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.2 }}
              >
                {t.headline}
              </motion.span>
            </h1>

            <p className="mt-6 text-base md:text-lg lg:text-xl text-muted-foreground leading-relaxed">
              {t.subheading}
            </p>

            <div className="mt-8">
              <p className="text-sm font-medium text-muted-foreground mb-4">{t.automateQuestion}</p>
              <div className="grid gap-4 md:grid-cols-2">
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ duration: 0.2 }}
                >
                  <Card className="border-primary/20 bg-primary/5 p-6 cursor-pointer hover:border-primary/40 transition-colors">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                        <Bot className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg">{t.aiSales.title}</h3>
                        <p className="text-sm text-muted-foreground">{t.aiSales.subtitle}</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground font-medium">Features:</p>
                      <div className="flex flex-wrap gap-2">
                        {t.aiSales.features.map((feature, i) => (
                          <span key={i} className="inline-flex items-center rounded-full bg-background px-2 py-1 text-xs">
                            {feature}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="mt-4 pt-4 border-t">
                      <p className="text-xs text-muted-foreground font-medium">Workflow:</p>
                      <p className="text-sm font-medium mt-1">{t.aiSales.workflow}</p>
                    </div>
                  </Card>
                </motion.div>

                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ duration: 0.2 }}
                >
                  <Card className="border-green-500/20 bg-green-500/5 p-6 cursor-pointer hover:border-green-500/40 transition-colors">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10">
                        <FileText className="h-6 w-6 text-green-500" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg">{t.invoices.title}</h3>
                        <p className="text-sm text-muted-foreground">{t.invoices.subtitle}</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground font-medium">Features:</p>
                      <div className="flex flex-wrap gap-2">
                        {t.invoices.features.map((feature, i) => (
                          <span key={i} className="inline-flex items-center rounded-full bg-background px-2 py-1 text-xs">
                            {feature}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="mt-4 pt-4 border-t">
                      <p className="text-xs text-muted-foreground font-medium">Workflow:</p>
                      <p className="text-sm font-medium mt-1">{t.invoices.workflow}</p>
                    </div>
                  </Card>
                </motion.div>
              </div>
            </div>

            <div className="mt-8 flex flex-col sm:flex-row gap-4">
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                transition={{ duration: 0.2 }}
              >
                <Button size="lg" className="text-base" asChild>
                  <Link to="/register">
                    {t.ctaPrimary} <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </motion.div>
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                transition={{ duration: 0.2 }}
              >
                <Button size="lg" variant="outline" className="text-base" asChild>
                  <Link to="/login">
                    {t.ctaSecondary}
                  </Link>
                </Button>
              </motion.div>
            </div>
          </motion.div>

          {/* Right side - AI Chat Preview */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative order-first lg:order-last"
          >
            <motion.div
              animate={{
                y: [0, -10, 0],
              }}
              transition={{
                duration: 6,
                repeat: Infinity,
                repeatType: "reverse",
                ease: "easeInOut"
              }}
              className="relative"
            >
              {/* Glow effect */}
              <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-accent/20 rounded-2xl blur-xl opacity-50" />

              {/* Main card */}
              <Card className="relative bg-card border-2 p-4 md:p-6 shadow-2xl">
                {/* Header */}
                <div className="flex items-center gap-3 pb-4 border-b">
                  <div className="flex h-8 w-8 md:h-10 md:w-10 items-center justify-center rounded-full bg-primary/10">
                    <Bot className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm md:text-base">AventryX AI</h3>
                    <p className="text-xs text-muted-foreground">Sales Assistant</p>
                  </div>
                  <div className="ml-auto">
                    <div className="inline-flex items-center rounded-full border border-input bg-background px-2 py-0.5 text-xs font-semibold">
                      Active
                    </div>
                  </div>
                </div>

                {/* Chat messages */}
                <div className="mt-4 space-y-3 md:space-y-4">
                  {/* Customer message */}
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 }}
                    className="flex gap-2 md:gap-3"
                  >
                    <div className="flex h-7 w-7 md:h-8 md:w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                      <User className="h-3 w-3 md:h-4 md:w-4" />
                    </div>
                    <div className="flex-1">
                      <div className="rounded-lg bg-muted p-2 md:p-3 text-xs md:text-sm">
                        {t.chat.customer1}
                      </div>
                    </div>
                  </motion.div>

                  {/* AI response */}
                  <motion.div
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 }}
                    className="flex gap-2 md:gap-3"
                  >
                    <div className="flex h-7 w-7 md:h-8 md:w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                      <Bot className="h-3 w-3 md:h-4 md:w-4 text-primary" />
                    </div>
                    <div className="flex-1">
                      <div className="rounded-lg bg-primary/10 p-2 md:p-3 text-xs md:text-sm">
                        {t.chat.ai1}
                      </div>
                    </div>
                  </motion.div>

                  {/* Customer message */}
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 }}
                    className="flex gap-2 md:gap-3"
                  >
                    <div className="flex h-7 w-7 md:h-8 md:w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                      <User className="h-3 w-3 md:h-4 md:w-4" />
                    </div>
                    <div className="flex-1">
                      <div className="rounded-lg bg-muted p-2 md:p-3 text-xs md:text-sm">
                        {t.chat.customer2}
                      </div>
                    </div>
                  </motion.div>

                  {/* AI response */}
                  <motion.div
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.6 }}
                    className="flex gap-2 md:gap-3"
                  >
                    <div className="flex h-7 w-7 md:h-8 md:w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                      <Bot className="h-3 w-3 md:h-4 md:w-4 text-primary" />
                    </div>
                    <div className="flex-1">
                      <div className="rounded-lg bg-primary/10 p-2 md:p-3 text-xs md:text-sm">
                        {t.chat.ai2}
                      </div>
                    </div>
                  </motion.div>

                  {/* Customer message */}
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.7 }}
                    className="flex gap-2 md:gap-3"
                  >
                    <div className="flex h-7 w-7 md:h-8 md:w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                      <User className="h-3 w-3 md:h-4 md:w-4" />
                    </div>
                    <div className="flex-1">
                      <div className="rounded-lg bg-muted p-2 md:p-3 text-xs md:text-sm">
                        {t.chat.customer3}
                      </div>
                    </div>
                  </motion.div>
                </div>

                {/* Success indicator */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.8 }}
                  className="mt-3 md:mt-4 pt-3 md:pt-4 border-t"
                >
                  <div className="flex items-center gap-2 text-xs md:text-sm">
                    <CheckCircle className="h-3 w-3 md:h-4 md:w-4 text-green-500" />
                    <span className="text-muted-foreground">{t.chat.success1}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs md:text-sm mt-1">
                    <CheckCircle className="h-3 w-3 md:h-4 md:w-4 text-green-500" />
                    <span className="text-muted-foreground">{t.chat.success2}</span>
                  </div>
                </motion.div>
              </Card>
            </motion.div>
          </motion.div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="font-display text-3xl">Muammo</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {[
            'Mijozlar kechasi yozadi — javob kechikadi',
            'Buyurtmalar chatda yo‘qoladi',
            'Savdo, ombor va foyda bitta joyda emas',
          ].map((t) => (
            <Card key={t}>{t}</Card>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="font-display text-3xl">SavdoPilot qanday ishlaydi</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-4">
          {['Biznesni ulang', 'Mahsulot kiriting', 'AI-Sotuvchi javob beradi', 'Dashboardda boshqaring'].map(
            (t, i) => (
              <Card key={t}>
                <p className="text-sm text-muted-foreground">0{i + 1}</p>
                <p className="mt-2 font-semibold">{t}</p>
              </Card>
            ),
          )}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="grid items-center gap-8 md:grid-cols-2">
          <div>
            <h2 className="font-display text-3xl">AI-Sotuvchi</h2>
            <p className="mt-3 text-muted-foreground">
              Narx, menyu, ish vaqti, manzil, buyurtma va bron — faqat sizning ma’lumotlaringiz
              asosida. Noma’lum savolga: “Bu ma’lumotni biznes egasidan aniqlab berishimiz kerak.”
            </p>
          </div>
          <Card className="space-y-3">
            <div className="rounded-xl bg-muted p-3 text-sm">Pepperoni qancha?</div>
            <div className="rounded-xl bg-primary/10 p-3 text-sm">Pepperoni narxi 89 000 so‘m.</div>
            <div className="rounded-xl bg-muted p-3 text-sm">2 ta buyurtma qilaman</div>
            <div className="rounded-xl bg-primary/10 p-3 text-sm">
              Pepperoni uchun buyurtma qabul qilindi.
            </div>
          </Card>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="font-display text-3xl">Dashboard Preview</h2>
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          {/* Sales Metrics */}
          <Card className="border-primary/20 bg-primary/5 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-semibold text-lg">Sales</h3>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">New Leads</span>
                <span className="font-semibold">{t.dashboard.sales.newLeads}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Orders</span>
                <span className="font-semibold">{t.dashboard.sales.orders}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Sales</span>
                <span className="font-semibold text-green-500">{t.dashboard.sales.sales}</span>
              </div>
            </div>
          </Card>

          {/* Collections Metrics */}
          <Card className="border-green-500/20 bg-green-500/5 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500/10">
                <DollarSign className="h-5 w-5 text-green-500" />
              </div>
              <h3 className="font-semibold text-lg">Collections</h3>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Outstanding</span>
                <span className="font-semibold">{t.dashboard.collections.outstanding}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Overdue</span>
                <span className="font-semibold text-red-500">{t.dashboard.collections.overdue}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Recovered by AI</span>
                <span className="font-semibold text-green-500">{t.dashboard.collections.recovered}</span>
              </div>
            </div>
          </Card>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="font-display text-3xl">Imkoniyatlar</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Bot, t: 'AI-Sotuvchi' },
            { icon: Package, t: 'Buyurtmalar' },
            { icon: Store, t: 'Ombor + CRM' },
            { icon: Wallet, t: 'Moliya' },
            { icon: Sparkles, t: 'AI Insights' },
            { icon: Mic, t: 'Voice AI' },
            { icon: Shield, t: 'RLS + rollar' },
            { icon: Store, t: 'Telegram / Instagram' },
          ].map((f) => (
            <Card key={f.t} className="flex items-center gap-3">
              <f.icon className="h-5 w-5 text-primary" />
              <span className="font-medium">{f.t}</span>
            </Card>
          ))}
        </div>
      </section>

      <PricingBlock />

      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="font-display text-3xl">Bonuslar</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Card>
            <h3 className="font-semibold">6 oylik</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              +1 oy bonus. Pro: +30% AI credits. Premium: +50% credits + Voice AI.
            </p>
          </Card>
          <Card>
            <h3 className="font-semibold">12 oylik</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              +2 oy bonus. Premium — 2× AI credits, VIP support, professional onboarding.
            </p>
          </Card>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="font-display text-3xl">FAQ</h2>
        <div className="mt-6 space-y-3">
          {faqs.map((f) => (
            <FaqItem key={f.q} q={f.q} a={f.a} />
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="font-display text-3xl">Mijozlar nima deydi</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {t.testimonials.map((t) => (
            <Card key={t.name}>
              <p className="text-sm">“{t.text}”</p>
              <p className="mt-3 text-xs text-muted-foreground">{t.name}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 text-center">
        <Card className="bg-primary text-primary-foreground">
          <h2 className="font-display text-3xl">Bugun AI-Sotuvchini ishga tushiring</h2>
          <p className="mt-3 opacity-90">7 kun bepul. Kartasiz boshlash mumkin (demo).</p>
          <Button className="mt-6" variant="gold" size="lg" asChild>
            <Link to="/register">Boshlash</Link>
          </Button>
        </Card>
      </section>

      <footer className="border-t px-4 py-10 text-sm text-muted-foreground">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 md:flex-row md:justify-between">
          <p>© {new Date().getFullYear()} AventryX AI</p>
          <div className="flex gap-4">
            <Link to="/pricing">Tariflar</Link>
            <Link to="/login">Kirish</Link>
            <Link to="/register">Ro‘yxatdan o‘tish</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <Card>
      <button className="flex w-full items-center justify-between text-left" onClick={() => setOpen(!open)}>
        <span className="font-medium">{q}</span>
        <ChevronDown className={cnRotate(open)} />
      </button>
      {open && <p className="mt-3 text-sm text-muted-foreground">{a}</p>}
    </Card>
  )
}

function cnRotate(open: boolean) {
  return cn('h-4 w-4', open && 'rotate-180')
}

export function PricingBlock() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16" id="pricing">
      <h2 className="font-display text-3xl">Tariflar</h2>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {(['free', 'pro', 'premium'] as const).map((code) => (
          <Card key={code} className={code === 'premium' ? 'ring-2 ring-accent' : ''}>
            {code === 'premium' && (
              <div className="mb-2 inline-flex items-center rounded-full bg-accent/30 px-2.5 py-0.5 text-xs font-semibold text-accent-foreground">
                Eng yaxshi qiymat — 12 oy
              </div>
            )}
            <h3 className="font-display text-2xl uppercase">{code}</h3>
            <p className="mt-2 font-display text-3xl">{formatSom(PLAN_PRICES[code])}</p>
            <p className="text-xs text-muted-foreground">oyiga</p>
            <ul className="mt-4 space-y-2 text-sm">
              {FEATURES[code].map((f) => (
                <li key={f} className="flex gap-2">
                  <Check className="h-4 w-4 text-primary" /> {f}
                </li>
              ))}
            </ul>
            <Button className="mt-6 w-full" asChild>
              <Link to="/register">Tanlash</Link>
            </Button>
          </Card>
        ))}
      </div>
    </section>
  )
}
