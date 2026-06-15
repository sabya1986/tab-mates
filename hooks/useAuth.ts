import { create } from 'zustand'
import { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

type AuthStore = {
  session: Session | null
  loading: boolean
  initialize: () => void
  signOut: () => Promise<void>
}

export const useAuthStore = create<AuthStore>((set) => ({
  session: null,
  loading: true,

  initialize: () => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      set({ session, loading: false })
    })

    supabase.auth.onAuthStateChange((_event, session) => {
      set({ session, loading: false })
    })
  },

  signOut: async () => {
    await supabase.auth.signOut()
    set({ session: null })
  },
}))
