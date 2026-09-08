import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  FileText,
  DollarSign,
  AlertCircle,
  CheckCircle,
  Clock,
  TrendingUp,
  Plus,
  Search,
  Filter,
  MoreVertical,
  Mail,
  Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { useSession } from '@/hooks/use-session'
import type { CollectionsMetrics } from '@/types'

export function InvoiceCollectionsPage() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'invoices' | 'followups'>('dashboard')
  const { business, state } = useSession()

  // Get invoices from store
  const invoices = state.invoices.filter((inv) => inv.businessId === business?.id)

  // Calculate metrics from actual data
  const metrics: CollectionsMetrics = {
    totalOutstanding: invoices
      .filter((inv) => inv.status !== 'paid')
      .reduce((sum, inv) => sum + inv.amount, 0),
    overdueAmount: invoices
      .filter((inv) => inv.status === 'overdue')
      .reduce((sum, inv) => sum + inv.amount, 0),
    aiRecovered: 8700, // Demo value - would be calculated from actual recoveries
    promisePayments: invoices
      .filter((inv) => inv.paymentPromise)
      .reduce((sum, inv) => sum + inv.amount, 0),
    activeCollections: invoices.filter((inv) => inv.status === 'overdue' || inv.status === 'sent').length,
    recoveryRate: 68, // Demo value
    avgCollectionDays: 14, // Demo value
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-500/10 text-green-500 border-green-500/20'
      case 'overdue':
        return 'bg-red-500/10 text-red-500 border-red-500/20'
      case 'promise':
        return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
      default:
        return 'bg-gray-500/10 text-gray-500 border-gray-500/20'
    }
  }

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount)
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b">
        <div className="mx-auto max-w-7xl px-4">
          <div className="flex items-center justify-between py-6">
            <div>
              <h1 className="font-display text-2xl font-semibold">Invoice Collections</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                AI-powered invoice collection and payment tracking
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm">
                <Filter className="mr-2 h-4 w-4" />
                Filter
              </Button>
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" />
                New Invoice
              </Button>
            </div>
          </div>
          <div className="flex gap-1">
            <Button
              variant={activeTab === 'dashboard' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('dashboard')}
            >
              Dashboard
            </Button>
            <Button
              variant={activeTab === 'invoices' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('invoices')}
            >
              Invoices
            </Button>
            <Button
              variant={activeTab === 'followups' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('followups')}
            >
              AI Follow-ups
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8">
        {activeTab === 'dashboard' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {/* Metrics Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <Card className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Outstanding</p>
                      <p className="mt-2 text-2xl font-semibold">
                        {formatCurrency(metrics.totalOutstanding, 'USD')}
                      </p>
                    </div>
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                      <DollarSign className="h-6 w-6 text-primary" />
                    </div>
                  </div>
                </Card>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <Card className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Overdue</p>
                      <p className="mt-2 text-2xl font-semibold text-red-500">
                        {formatCurrency(metrics.overdueAmount, 'USD')}
                      </p>
                    </div>
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
                      <AlertCircle className="h-6 w-6 text-red-500" />
                    </div>
                  </div>
                </Card>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <Card className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">AI Recovered</p>
                      <p className="mt-2 text-2xl font-semibold text-green-500">
                        {formatCurrency(metrics.aiRecovered, 'USD')}
                      </p>
                    </div>
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10">
                      <Zap className="h-6 w-6 text-green-500" />
                    </div>
                  </div>
                </Card>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <Card className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Recovery Rate</p>
                      <p className="mt-2 text-2xl font-semibold">
                        {metrics.recoveryRate}%
                      </p>
                    </div>
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/10">
                      <TrendingUp className="h-6 w-6 text-blue-500" />
                    </div>
                  </div>
                </Card>
              </motion.div>
            </div>

            {/* Recent Invoices */}
            <Card className="mt-8">
              <div className="border-b p-6">
                <h2 className="font-display text-lg font-semibold">Recent Invoices</h2>
              </div>
              <div className="divide-y">
                {invoices.map((invoice, i) => (
                  <motion.div
                    key={invoice.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 + i * 0.1 }}
                    className="flex items-center justify-between p-6 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                        <FileText className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{invoice.clientName}</p>
                        <p className="text-sm text-muted-foreground">
                          {invoice.invoiceNumber} • Due: {new Date(invoice.dueDate).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="font-medium">
                          {formatCurrency(invoice.amount, invoice.currency)}
                        </p>
                        {invoice.daysOverdue && invoice.daysOverdue > 0 && (
                          <p className="text-sm text-red-500">
                            {invoice.daysOverdue} days overdue
                          </p>
                        )}
                        {invoice.paymentPromise && (
                          <p className="text-sm text-yellow-500">
                            Promise: {new Date(invoice.paymentPromise).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      <Badge className={cn('border', getStatusColor(invoice.status))}>
                        {invoice.status}
                      </Badge>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </Card>
          </motion.div>
        )}

        {activeTab === 'invoices' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Card>
              <div className="border-b p-6">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-lg font-semibold">All Invoices</h2>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder="Search invoices..."
                        className="h-9 w-64 rounded-md border border-input bg-background pl-8 pr-3 text-sm"
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className="divide-y">
                {invoices.map((invoice, i) => (
                  <motion.div
                    key={invoice.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="flex items-center justify-between p-6 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                        <FileText className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{invoice.clientName}</p>
                        <p className="text-sm text-muted-foreground">
                          {invoice.invoiceNumber} • {invoice.clientEmail}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="font-medium">
                          {formatCurrency(invoice.amount, invoice.currency)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Due: {new Date(invoice.dueDate).toLocaleDateString()}
                        </p>
                      </div>
                      <Badge className={cn('border', getStatusColor(invoice.status))}>
                        {invoice.status}
                      </Badge>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </Card>
          </motion.div>
        )}

        {activeTab === 'followups' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Card>
              <div className="border-b p-6">
                <h2 className="font-display text-lg font-semibold">AI Follow-up Agent</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Automated payment reminders and response analysis
                </p>
              </div>
              <div className="p-6">
                <div className="flex items-center gap-4 rounded-lg border bg-muted/50 p-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                    <Zap className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">AI Follow-up Agent Active</p>
                    <p className="text-sm text-muted-foreground">
                      Automatically sends reminders and analyzes responses
                    </p>
                  </div>
                  <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
                    Active
                  </Badge>
                </div>

                <div className="mt-6 space-y-4">
                  <div className="flex items-center gap-4 rounded-lg border p-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/10">
                      <Mail className="h-5 w-5 text-blue-500" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">Email Follow-ups</p>
                      <p className="text-sm text-muted-foreground">
                        Automatic email reminders for overdue invoices
                      </p>
                    </div>
                    <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">
                      Enabled
                    </Badge>
                  </div>

                  <div className="flex items-center gap-4 rounded-lg border p-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500/10">
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">Response Analysis</p>
                      <p className="text-sm text-muted-foreground">
                        AI understands payment promises and difficulties
                      </p>
                    </div>
                    <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
                      Enabled
                    </Badge>
                  </div>

                  <div className="flex items-center gap-4 rounded-lg border p-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-500/10">
                      <Clock className="h-5 w-5 text-yellow-500" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">Promise Tracking</p>
                      <p className="text-sm text-muted-foreground">
                        Tracks payment promises and sends follow-ups
                      </p>
                    </div>
                    <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
                      Enabled
                    </Badge>
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </div>
    </div>
  )
}
