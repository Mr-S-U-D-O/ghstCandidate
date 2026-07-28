import React, { createContext, useState, useEffect, useContext } from 'react'
import type { ReactNode } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '../supabaseClient'

export interface CandidateProfile {
  name: string
  email: string
  targetRoles: string[]
  locations: string[]
  skills: string[]
  rawResumeText: string
  rawCoverLetterText: string
  [key: string]: any
}

interface UserContextType {
  user: User | null
  session: Session | null
  candidateProfile: CandidateProfile
  setCandidateProfile: React.Dispatch<React.SetStateAction<CandidateProfile>>
  syncProfile: (overrides?: Partial<CandidateProfile>) => Promise<void>
  isLoadingAuth: boolean
  hasProfile: boolean
}

const defaultProfile: CandidateProfile = {
  name: '',
  email: '',
  targetRoles: [],
  locations: [],
  skills: [],
  rawResumeText: '',
  rawCoverLetterText: ''
}

export const UserContext = createContext<UserContextType>({
  user: null,
  session: null,
  candidateProfile: defaultProfile,
  setCandidateProfile: () => {},
  syncProfile: async () => {},
  isLoadingAuth: true,
  hasProfile: false
})

export const useUser = () => useContext(UserContext)

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [candidateProfile, setCandidateProfile] = useState<CandidateProfile>(defaultProfile)
  const [isLoadingAuth, setIsLoadingAuth] = useState(true)
  const [hasProfile, setHasProfile] = useState(false)

  // Load profile from Supabase DB
  const loadProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = row not found (new user, not an error)
      console.error('[UserContext] Failed to load profile:', error.message)
      return
    }

    if (data) {
      const { extra_data, ...rest } = data
      setCandidateProfile({
        name: rest.name || '',
        email: rest.email || '',
        targetRoles: rest.target_roles || [],
        locations: rest.locations || [],
        skills: rest.skills || [],
        rawResumeText: rest.raw_resume_text || '',
        rawCoverLetterText: rest.raw_cover_letter_text || '',
        ...(extra_data || {})
      })
      setHasProfile(true)
    } else {
      setHasProfile(false)
    }
  }

  // Upsert profile to Supabase DB
  const syncProfile = async (overrides?: Partial<CandidateProfile>) => {
    if (!user) return
    const current = { ...candidateProfile, ...(overrides || {}) }

    // Separate known fields from dynamic extra_data
    const { name, email, targetRoles, locations, skills, rawResumeText, rawCoverLetterText, ...extra_data } = current

    const { error } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        name,
        email,
        target_roles: targetRoles,
        locations,
        skills,
        raw_resume_text: rawResumeText,
        raw_cover_letter_text: rawCoverLetterText,
        extra_data
      }, { onConflict: 'id' })

    if (error) {
      console.error('[UserContext] Failed to sync profile:', error.message)
    } else {
      setHasProfile(true)
      console.log('[UserContext] Profile synced to Supabase.')
    }
  }

  // Auth state listener — runs on mount
  useEffect(() => {
    // Get the initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        await loadProfile(session.user.id)
      }
      setIsLoadingAuth(false)
    })

    // Listen for future auth changes
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        loadProfile(session.user.id)
      } else {
        setCandidateProfile(defaultProfile)
      }
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  return (
    <UserContext.Provider value={{ user, session, candidateProfile, setCandidateProfile, syncProfile, isLoadingAuth, hasProfile }}>
      {children}
    </UserContext.Provider>
  )
}
