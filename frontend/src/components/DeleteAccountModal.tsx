import { useState } from 'react'
import { supabase } from '../supabaseClient'
import { AlertTriangle } from 'lucide-react'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'

interface DeleteAccountModalProps {
  isOpen: boolean
  onClose: () => void
  userName: string
}

export default function DeleteAccountModal({ isOpen, onClose, userName }: DeleteAccountModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [inputValue, setInputValue] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const handleClose = () => {
    // Reset state on close
    setStep(1)
    setInputValue('')
    setError(null)
    setIsDeleting(false)
    onClose()
  }

  const handleDelete = async () => {
    if (inputValue !== userName) return
    setIsDeleting(true)
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`${API_BASE_URL}/api/user/account`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Unknown error' }))
        throw new Error(err.message || 'Failed to delete account.')
      }

      // Success — sign out and redirect
      await supabase.auth.signOut()
      window.location.href = '/auth'
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred.')
      setIsDeleting(false)
    }
  }

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={handleClose}
    >
      {/* Modal Panel */}
      <div
        className="relative w-full max-w-md mx-4 bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-gray-100">
          <h2 className="font-heading font-bold text-lg text-[#0A0A0A]">Delete Account</h2>
          <p className="font-sans text-sm text-gray-400 mt-0.5">Step {step} of 3</p>
        </div>

        {/* Step 1: Intent */}
        {step === 1 && (
          <div className="px-6 py-6">
            <p className="font-sans text-sm text-gray-600 leading-relaxed">
              This is a permanent, irreversible action. Before you continue, make sure you understand the consequences.
            </p>
            <button
              onClick={() => setStep(2)}
              className="mt-6 w-full py-3 font-sans text-sm font-medium text-[#0A0A0A] bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              I want to delete my account
            </button>
          </div>
        )}

        {/* Step 2: Warning */}
        {step === 2 && (
          <div className="px-6 py-6">
            <div className="flex gap-3 p-4 border border-amber-200 bg-amber-50 rounded-lg">
              <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" strokeWidth={1.5} />
              <div>
                <p className="font-sans text-sm font-semibold text-amber-800">
                  Unexpected bad things will happen if you don't read this!
                </p>
                <p className="font-sans text-sm text-amber-700 mt-1 leading-relaxed">
                  This will permanently delete your <strong>Candidate Profile</strong>, <strong>Kanban board</strong>, generated <strong>Resumes</strong>, <strong>Cover Letters</strong>, and <strong>AI Memories</strong>. There is no going back.
                </p>
              </div>
            </div>
            <button
              onClick={() => setStep(3)}
              className="mt-6 w-full py-3 font-sans text-sm font-medium text-[#0A0A0A] bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              I have read and understand these effects
            </button>
          </div>
        )}

        {/* Step 3: Confirmation */}
        {step === 3 && (
          <div className="px-6 py-6">
            <p className="font-sans text-sm text-gray-600 leading-relaxed">
              To confirm, type{' '}
              <code className="font-sans font-semibold text-[#0A0A0A] bg-gray-100 px-1.5 py-0.5 rounded">
                {userName}
              </code>{' '}
              in the box below.
            </p>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={userName}
              autoFocus
              className="mt-4 w-full px-4 py-3 font-sans text-sm text-[#0A0A0A] bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-[#0A0A0A] transition-colors placeholder:text-gray-300"
            />
            {error && (
              <p className="mt-2 font-sans text-xs text-red-600">{error}</p>
            )}
            <button
              onClick={handleDelete}
              disabled={inputValue !== userName || isDeleting}
              className={`mt-4 w-full py-3 font-sans text-sm font-medium rounded-lg border transition-colors ${
                inputValue === userName && !isDeleting
                  ? 'bg-red-600 text-white border-red-600 hover:bg-red-700'
                  : 'bg-gray-100 text-gray-300 border-gray-100 cursor-not-allowed'
              }`}
            >
              {isDeleting ? 'Deleting...' : 'Delete my account'}
            </button>
          </div>
        )}

        {/* Footer close link */}
        <div className="px-6 pb-5 text-center">
          <button
            onClick={handleClose}
            className="font-sans text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            Cancel — keep my account
          </button>
        </div>
      </div>
    </div>
  )
}
