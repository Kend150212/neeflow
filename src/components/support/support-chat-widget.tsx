'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { MessageSquare, X, Send, Bot, Loader2, LifeBuoy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

/**
 * SupportChatWidget — Floating chat bubble placeholder.
 * Ready for chatbot integration via the `isBotMsg` field in `TicketMessage`.
 *
 * To connect a chatbot:
 * 1. Replace the `autoBotReply` function with your bot API call
 * 2. Set `isBotMsg: true` when creating the ticket message via POST /api/support/tickets/[id]
 */

interface Message {
    id: string
    role: 'user' | 'bot'
    content: string
    ts: Date
}

function BotAvatar() {
    return (
        <Avatar className="h-7 w-7 shrink-0">
            <AvatarFallback className="bg-primary/10 text-primary">
                <Bot className="h-4 w-4" />
            </AvatarFallback>
        </Avatar>
    )
}

export function SupportChatWidget() {
    const router = useRouter()
    const [open, setOpen] = useState(false)
    const [messages, setMessages] = useState<Message[]>([
        {
            id: 'welcome',
            role: 'bot',
            content: 'Hi! 👋 How can I help you today? I can help you find articles or create a support ticket.',
            ts: new Date(),
        },
    ])
    const [input, setInput] = useState('')
    const [thinking, setThinking] = useState(false)

    // Auto-scroll to bottom
    useEffect(() => {
        if (!open) return
        const el = document.getElementById('chat-scroll')
        if (el) el.scrollTop = el.scrollHeight
    }, [messages, open])

    const send = async () => {
        if (!input.trim() || thinking) return
        const userMsg: Message = { id: Date.now().toString(), role: 'user', content: input, ts: new Date() }
        setMessages(prev => [...prev, userMsg])
        setInput('')
        setThinking(true)

        // Bot response placeholder — replace with real bot API
        await new Promise(r => setTimeout(r, 900))
        const botReply: Message = {
            id: Date.now().toString() + '_bot',
            role: 'bot',
            content: autoBotReply(userMsg.content),
            ts: new Date(),
        }
        setMessages(prev => [...prev, botReply])
        setThinking(false)
    }

    return (
        <>
            {/* Floating button */}
            <button
                onClick={() => setOpen(o => !o)}
                className={cn(
                    'fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full flex items-center justify-center shadow-lg',
                    'bg-primary text-primary-foreground transition-all hover:scale-105 active:scale-95',
                    'md:flex hidden', // hidden on mobile (they have bottom nav)
                )}
                aria-label="Support chat"
            >
                {open ? <X className="h-5 w-5" /> : <MessageSquare className="h-5 w-5" />}
            </button>

            {/* Chat window */}
            {open && (
                <div className={cn(
                    'fixed bottom-24 right-6 z-50 w-80 rounded-2xl shadow-2xl border bg-background overflow-hidden',
                    'hidden md:flex flex-col',
                    'max-h-[480px]',
                )}>
                    {/* Header */}
                    <div className="bg-primary px-4 py-3 text-primary-foreground flex items-center gap-3">
                        <BotAvatar />
                        <div>
                            <p className="text-sm font-semibold">Support Assistant</p>
                            <p className="text-xs opacity-80">Always here to help</p>
                        </div>
                        <button onClick={() => setOpen(false)} className="ml-auto opacity-70 hover:opacity-100">
                            <X className="h-4 w-4" />
                        </button>
                    </div>

                    {/* Messages */}
                    <div id="chat-scroll" className="flex-1 overflow-y-auto p-4 space-y-3">
                        {messages.map(msg => (
                            <div key={msg.id} className={cn('flex gap-2', msg.role === 'user' ? 'flex-row-reverse' : 'flex-row')}>
                                {msg.role === 'bot' && <BotAvatar />}
                                <div className={cn(
                                    'rounded-2xl px-3 py-2 text-sm max-w-[200px]',
                                    msg.role === 'user'
                                        ? 'bg-primary text-primary-foreground rounded-tr-sm'
                                        : 'bg-muted rounded-tl-sm',
                                )}>
                                    {msg.content}
                                </div>
                            </div>
                        ))}
                        {thinking && (
                            <div className="flex gap-2">
                                <BotAvatar />
                                <div className="bg-muted rounded-2xl rounded-tl-sm px-3 py-2 text-sm">
                                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Quick actions */}
                    <div className="px-3 pb-2 flex gap-1.5">
                        <button
                            onClick={() => { router.push('/dashboard/support/kb'); setOpen(false) }}
                            className="text-xs border rounded-full px-3 py-1 hover:bg-muted transition-colors"
                        >
                            Browse Articles
                        </button>
                        <button
                            onClick={() => { router.push('/dashboard/support'); setOpen(false) }}
                            className="text-xs border rounded-full px-3 py-1 hover:bg-muted transition-colors"
                        >
                            Contact Support
                        </button>
                    </div>

                    {/* Input */}
                    <div className="border-t px-3 py-2 flex gap-2 items-end">
                        <Textarea
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
                            placeholder="Ask anything..."
                            rows={1}
                            className="resize-none text-sm min-h-[36px]"
                        />
                        <Button size="icon" className="h-8 w-8 shrink-0" onClick={send} disabled={!input.trim() || thinking}>
                            <Send className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                </div>
            )}
        </>
    )
}

/**
 * Simple rule-based bot replies.
 * Replace this with a real AI/bot API call to enable intelligent responses.
 */
function autoBotReply(userMessage: string): string {
    const msg = userMessage.toLowerCase()
    if (msg.includes('billing') || msg.includes('invoice') || msg.includes('payment')) {
        return "For billing questions, please create a support ticket and select 'Billing' as the category. Our team will respond within 24 hours. 💳"
    }
    if (msg.includes('bug') || msg.includes('error') || msg.includes('broken') || msg.includes('not working')) {
        return "Sorry to hear something isn't working! Please create a support ticket with details about what you were doing and what happened. 🔧"
    }
    if (msg.includes('article') || msg.includes('how') || msg.includes('guide') || msg.includes('tutorial')) {
        return "Check our Knowledge Base for guides and tutorials! Click 'Browse Articles' below to search for what you need. 📚"
    }
    if (msg.includes('hello') || msg.includes('hi') || msg.includes('hey')) {
        return "Hello! 😊 I can help you find articles or connect you with our support team. What do you need help with?"
    }
    return "I'd like to help! For the best assistance, please create a support ticket and our team will get back to you shortly. You can also browse our Knowledge Base for instant answers. 🎯"
}
