import { useMemo, useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, Badge } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useSession } from '@/hooks/use-session'
import { formatTimeRelative } from '@/lib/utils'
import { Bot, User, Send, MessageSquare, UserCircle, Sparkles } from 'lucide-react'

export function AiSellerPage() {
  const { business, state, actions } = useSession()
  const convos = state.conversations.filter((c) => c.businessId === business?.id)
  const [id, setId] = useState(convos[0]?.id ?? '')
  const [text, setText] = useState('')
  const [humanText, setHumanText] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const current = convos.find((c) => c.id === id) ?? convos[0]
  const messages = useMemo(
    () => state.messages.filter((m) => m.conversationId === current?.id),
    [state.messages, current?.id],
  )

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleCustomerMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim() || !current) return
    setLoading(true)
    try {
      await actions.sendAiMessage(current.id, text, false)
      setText('')
    } finally {
      setLoading(false)
    }
  }

  function handleHumanReply(e: React.FormEvent) {
    e.preventDefault()
    if (!humanText.trim() || !current) return
    actions.humanReply(current.id, humanText)
    setHumanText('')
  }

  function handleNewConversation() {
    const c = actions.startConversation('Yangi mijoz', 'web')
    if (c) setId(c.id)
  }

  function getChannelIcon(channel: string) {
    switch (channel) {
      case 'telegram':
        return <MessageSquare className="h-4 w-4" />
      case 'instagram':
        return <UserCircle className="h-4 w-4" />
      case 'voice':
        return <Sparkles className="h-4 w-4" />
      default:
        return <MessageSquare className="h-4 w-4" />
    }
  }

  function getMessageIcon(role: string) {
    switch (role) {
      case 'customer':
        return <User className="h-4 w-4" />
      case 'ai':
        return <Bot className="h-4 w-4" />
      case 'human':
        return <UserCircle className="h-4 w-4" />
      default:
        return <MessageSquare className="h-4 w-4" />
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-3xl">AI-Sotuvchi</h1>
        <p className="text-muted-foreground">{business?.name}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        {/* Conversation List */}
        <Card className="p-4 h-[600px] flex flex-col">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">Suhbatlar</h2>
            <Button size="sm" variant="outline" onClick={handleNewConversation}>
              <MessageSquare className="mr-2 h-4 w-4" />
              Yangi
            </Button>
          </div>
          <div className="flex-1 space-y-2 overflow-y-auto">
            {convos.length === 0 ? (
              <div className="text-center py-8">
                <MessageSquare className="mx-auto h-12 w-12 text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">Suhbatlar yo‘q</p>
              </div>
            ) : (
              convos.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setId(c.id)}
                  className={`w-full rounded-xl p-3 text-left transition-colors ${
                    current?.id === c.id ? 'bg-primary/10 border border-primary/20' : 'hover:bg-muted'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-1 text-muted-foreground">
                      {getChannelIcon(c.channel)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="font-medium truncate">{c.customerName}</p>
                        <Badge
                          tone={c.status === 'human' ? 'gold' : 'muted'}
                          className="text-xs"
                        >
                          {c.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatTimeRelative(c.lastMessageAt)}
                      </p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </Card>

        {/* Chat Interface */}
        <Card className="flex min-h-[600px] flex-col">
          {current ? (
            <>
              {/* Chat Header */}
              <div className="flex items-center justify-between border-b p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                    {getChannelIcon(current.channel)}
                  </div>
                  <div>
                    <h2 className="font-semibold">{current.customerName}</h2>
                    <div className="flex items-center gap-2">
                      <Badge
                        tone={current.status === 'human' ? 'gold' : 'muted'}
                        className="text-xs"
                      >
                        {current.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {current.channel}
                      </span>
                    </div>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => actions.takeover(current.id, current.status !== 'human')}
                >
                  {current.status === 'human' ? 'AIga qaytarish' : 'Human takeover'}
                </Button>
              </div>

              {/* Messages */}
              <div className="flex-1 space-y-4 overflow-y-auto p-4">
                {messages.length === 0 ? (
                  <div className="flex h-full items-center justify-center">
                    <div className="text-center">
                      <Bot className="mx-auto h-12 w-12 text-muted-foreground" />
                      <p className="mt-2 text-sm text-muted-foreground">
                        Suhbat boshlanishi uchun mijoz xabar yuboring
                      </p>
                    </div>
                  </div>
                ) : (
                  messages.map((m) => (
                    <div
                      key={m.id}
                      className={`flex ${m.role === 'customer' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                          m.role === 'customer'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          {getMessageIcon(m.role)}
                          <span className="text-xs font-medium uppercase opacity-70">
                            {m.role}
                          </span>
                        </div>
                        <p className="text-sm">{m.content}</p>
                        <p className="text-xs opacity-70 mt-1">{formatTimeRelative(m.createdAt)}</p>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <div className="border-t p-4 space-y-3">
                <form className="flex gap-2" onSubmit={handleCustomerMessage}>
                  <Input
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Mijoz xabari (test uchun)"
                    disabled={loading}
                  />
                  <Button type="submit" disabled={loading || !text.trim()}>
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
                {current.status === 'human' && (
                  <form className="flex gap-2" onSubmit={handleHumanReply}>
                    <Input
                      value={humanText}
                      onChange={(e) => setHumanText(e.target.value)}
                      placeholder="Sizning javobingiz (human mode)"
                    />
                    <Button type="submit" variant="default" disabled={!humanText.trim()}>
                      <Send className="h-4 w-4 mr-2" />
                      Yuborish
                    </Button>
                  </form>
                )}
              </div>
            </>
          ) : (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <MessageSquare className="mx-auto h-12 w-12 text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">
                  Suhbatni boshlash uchun "Yangi" tugmasini bosing
                </p>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
