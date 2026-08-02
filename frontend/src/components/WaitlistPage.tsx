import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Loader2, Check } from 'lucide-react'

export default function WaitlistPage() {
  const [formData, setFormData] = useState({
    name: '',
    surname: '',
    email: '',
    phone: '',
    inform_on_launch: false,
    keep_posted: false
  })
  
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isFormValid = formData.email.trim() !== '' && formData.inform_on_launch

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isFormValid) return

    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'}/api/waitlist`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      })

      if (!response.ok) {
        throw new Error('Failed to join waitlist. Please try again.')
      }

      setIsSuccess(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isSuccess) {
    return (
      <div className="w-screen h-screen flex flex-col items-center justify-center bg-white text-[#0A0A0A]">
        <div className="w-16 h-16 bg-black rounded-full flex items-center justify-center mb-6 text-white animate-bounce">
          <Check size={32} />
        </div>
        <h1 className="font-heading font-bold text-4xl mb-4 tracking-tight">You're on the list.</h1>
        <p className="font-sans text-gray-500 mb-8 max-w-sm text-center leading-relaxed">
          Thank you for joining the closed beta waitlist. We'll send you an email as soon as we open up more access.
        </p>
        <Link to="/" className="font-sans font-medium text-sm text-gray-400 hover:text-black transition-colors">
          Return to home
        </Link>
      </div>
    )
  }

  return (
    <div className="relative w-screen min-h-screen bg-white text-[#0A0A0A] flex flex-col p-6 md:p-12 items-center justify-center">
      <Link
        to="/"
        className="absolute top-6 left-6 flex items-center gap-2 text-sm font-sans font-medium text-gray-500 hover:text-black transition-colors"
      >
        <ArrowLeft size={16} />
        Back
      </Link>

      <div className="w-full max-w-md">
        <div className="flex flex-col items-center text-center mb-12">
          <img src="/logo-transparent.png" alt="Ghost Logo" className="h-10 w-auto mb-6" />
          <h1 className="font-heading font-bold text-4xl tracking-tight mb-3">Join the Ghost</h1>
          <p className="font-sans text-gray-500 text-sm">
            We're currently in closed beta. Secure your spot in the queue.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-4">
            <input
              type="text"
              name="name"
              placeholder="Name"
              value={formData.name}
              onChange={handleChange}
              className="w-full bg-transparent border-b border-black py-3 font-sans text-sm placeholder-gray-400 focus:outline-none focus:border-b-2 focus:border-[#ff6900] transition-colors"
            />
            <input
              type="text"
              name="surname"
              placeholder="Surname"
              value={formData.surname}
              onChange={handleChange}
              className="w-full bg-transparent border-b border-black py-3 font-sans text-sm placeholder-gray-400 focus:outline-none focus:border-b-2 focus:border-[#ff6900] transition-colors"
            />
          </div>

          <input
            type="email"
            name="email"
            placeholder="Email *"
            required
            value={formData.email}
            onChange={handleChange}
            className="w-full bg-transparent border-b border-black py-3 font-sans text-sm placeholder-gray-400 focus:outline-none focus:border-b-2 focus:border-[#ff6900] transition-colors"
          />

          <input
            type="text"
            name="phone"
            placeholder="Phone Number"
            value={formData.phone}
            onChange={handleChange}
            className="w-full bg-transparent border-b border-black py-3 font-sans text-sm placeholder-gray-400 focus:outline-none focus:border-b-2 focus:border-[#ff6900] transition-colors"
          />

          <div className="flex flex-col gap-4 mt-4">
            <label className="flex items-center gap-3 cursor-pointer group">
              <div className="relative flex items-center justify-center w-5 h-5">
                <input
                  type="checkbox"
                  name="inform_on_launch"
                  checked={formData.inform_on_launch}
                  onChange={handleChange}
                  className="peer appearance-none w-5 h-5 border border-gray-300 rounded-sm checked:bg-black checked:border-black transition-colors focus:outline-none cursor-pointer"
                />
                <Check size={14} className="absolute text-white opacity-0 peer-checked:opacity-100 pointer-events-none transition-opacity" />
              </div>
              <span className="font-sans text-sm text-gray-700 group-hover:text-black transition-colors">
                Inform me when we launch <span className="text-red-500 font-bold">*</span>
              </span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer group">
              <div className="relative flex items-center justify-center w-5 h-5">
                <input
                  type="checkbox"
                  name="keep_posted"
                  checked={formData.keep_posted}
                  onChange={handleChange}
                  className="peer appearance-none w-5 h-5 border border-gray-300 rounded-sm checked:bg-black checked:border-black transition-colors focus:outline-none cursor-pointer"
                />
                <Check size={14} className="absolute text-white opacity-0 peer-checked:opacity-100 pointer-events-none transition-opacity" />
              </div>
              <span className="font-sans text-sm text-gray-700 group-hover:text-black transition-colors">
                Keep me posted on weekly updates
              </span>
            </label>
          </div>

          {error && (
            <p className="font-sans text-xs text-red-500 bg-red-50 p-3 rounded-md mt-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={!isFormValid || isSubmitting}
            className={`mt-4 py-4 w-full font-sans font-bold text-sm tracking-wide flex items-center justify-center transition-all ${
              isFormValid
                ? 'bg-[#ff6900] text-white shadow-md hover:bg-[#e65c00]'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : 'JOIN WAITLIST'}
          </button>
        </form>
      </div>
    </div>
  )
}
