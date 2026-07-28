import React, { useState, useEffect, useContext, useRef } from 'react'
import { UserContext } from '../context/UserContext'
import { supabase } from '../supabaseClient'
import { Send, Bot } from 'lucide-react'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'

interface ChatMessage {
  role: 'user' | 'ghost'
  text: string
}

export default function GhostChat() {
  const { user, candidateProfile, setCandidateProfile, syncProfile } = useContext(UserContext)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [isLoadingHistory, setIsLoadingHistory] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const hasInitialized = useRef(false)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, isTyping])

  // Load chat history from Supabase on mount
  useEffect(() => {
    if (!user) return

    const loadHistory = async () => {
      const { data, error } = await supabase
        .from('chat_history')
        .select('role, text')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })

      if (error) {
        console.error('[GhostChat] Failed to load history:', error.message)
        setIsLoadingHistory(false)
        sendMessage('', true)
        return
      }

      if (data && data.length > 0) {
        setMessages(data as ChatMessage[])
        setIsLoadingHistory(false)
        hasInitialized.current = true
      } else {
        // No history — trigger an initial greeting
        setIsLoadingHistory(false)
        if (!hasInitialized.current) {
          hasInitialized.current = true
          sendMessage('', true)
        }
      }
    }

    loadHistory()
  }, [user])

  const sendMessage = async (text: string, isInitial = false) => {
    if (!isInitial && !text.trim()) return

    const newMessages = isInitial ? [] : [...messages, { role: 'user', text } as ChatMessage]
    if (!isInitial) {
      setMessages(newMessages)
      // Persist user message immediately
      if (user) {
        await supabase.from('chat_history').insert({ user_id: user.id, role: 'user', text })
      }
    }

    setInputValue('')
    setIsTyping(true)

    try {
      const res = await fetch(`${API_BASE_URL}/api/chat-profiler`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentProfile: candidateProfile,
          userMessage: text,
          chatHistory: newMessages.map(m => ({ role: m.role, text: m.text }))
        })
      })

      const data = await res.json()
      const ghostMsg: ChatMessage = { role: 'ghost', text: data.reply }

      setMessages(prev => [...prev, ghostMsg])

      // Persist ghost reply
      if (user) {
        await supabase.from('chat_history').insert({ user_id: user.id, role: 'ghost', text: data.reply })
      }

      if (data.profileUpdates && Object.keys(data.profileUpdates).length > 0) {
        const merged = { ...candidateProfile, ...data.profileUpdates }
        setCandidateProfile(merged)
        // Persist updated profile to Supabase
        await syncProfile(merged)
      }
    } catch (err) {
      const errorMsg: ChatMessage = { role: 'ghost', text: "I'm having trouble connecting to my brain. Please try again later." }
      setMessages(prev => [...prev, errorMsg])
    } finally {
      setIsTyping(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      sendMessage(inputValue)
    }
  }

  if (isLoadingHistory) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50 rounded-2xl border border-gray-200">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-black flex items-center justify-center animate-pulse">
            <Bot size={16} className="text-white" />
          </div>
          <p className="font-sans text-sm text-gray-400">Loading conversation history...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-gray-50 rounded-2xl overflow-hidden border border-gray-200 relative">
      {/* Header */}
      <div className="shrink-0 bg-white border-b border-gray-200 px-8 py-5">
        <h2 className="font-heading font-bold text-2xl text-[#0A0A0A]">Ghost Profiler</h2>
        <p className="font-sans text-sm text-gray-500 mt-1">I'll ask a few questions to perfect your profile.</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-8 space-y-6">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'ghost' && (
              <div className="w-8 h-8 rounded-full bg-black flex items-center justify-center mr-3 mt-1 shrink-0">
                <Bot size={16} className="text-white" />
              </div>
            )}
            <div 
              className={`max-w-lg px-6 py-3 font-sans text-sm leading-relaxed ${
                msg.role === 'user' 
                  ? 'bg-black text-white rounded-2xl rounded-tr-sm' 
                  : 'bg-white text-gray-800 border border-gray-200 rounded-2xl rounded-tl-sm shadow-sm'
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start">
            <div className="w-8 h-8 rounded-full bg-black flex items-center justify-center mr-3 mt-1 shrink-0">
              <Bot size={16} className="text-white" />
            </div>
            <div className="max-w-lg px-6 py-4 bg-white text-gray-800 border border-gray-200 rounded-2xl rounded-tl-sm shadow-sm flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 p-4 pb-8 md:p-6 bg-white border-t border-gray-200">
        <div className="relative max-w-4xl mx-auto flex items-center">
          <input 
            type="text" 
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your answer..."
            disabled={isTyping}
            className="w-full bg-gray-50 border border-gray-200 text-black font-sans text-base md:text-sm rounded-full pl-6 pr-14 py-4 focus:outline-none focus:border-gray-400 focus:bg-white transition-colors disabled:opacity-50"
          />
          <button 
            onClick={() => sendMessage(inputValue)}
            disabled={!inputValue.trim() || isTyping}
            className="absolute right-2 top-2 bottom-2 w-10 h-10 bg-black rounded-full flex items-center justify-center text-white hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            <Send size={16} className="-ml-0.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
