import React, { createContext, useState, ReactNode } from 'react'

export interface CandidateProfile {
  name: string
  email: string
  targetRoles: string[]
  locations: string[]
  skills: string[]
  rawResumeText: string
}

interface UserContextType {
  candidateProfile: CandidateProfile
  setCandidateProfile: React.Dispatch<React.SetStateAction<CandidateProfile>>
}

const defaultProfile: CandidateProfile = {
  name: '',
  email: '',
  targetRoles: [],
  locations: [],
  skills: [],
  rawResumeText: ''
}

export const UserContext = createContext<UserContextType>({
  candidateProfile: defaultProfile,
  setCandidateProfile: () => {}
})

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [candidateProfile, setCandidateProfile] = useState<CandidateProfile>(defaultProfile)

  return (
    <UserContext.Provider value={{ candidateProfile, setCandidateProfile }}>
      {children}
    </UserContext.Provider>
  )
}
