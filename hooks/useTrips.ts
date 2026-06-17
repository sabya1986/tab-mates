import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import type { Trip } from '../lib/types'

type TripsStore = {
  trips: Trip[]
  loading: boolean
  fetchTrips: () => Promise<void>
  createTrip: (name: string, description: string, currency: string) => Promise<Trip | null>
}

export const useTripsStore = create<TripsStore>((set) => ({
  trips: [],
  loading: false,

  fetchTrips: async () => {
    set({ loading: true })
    const { data, error } = await supabase
      .from('trips')
      .select(`
        *,
        trip_members!inner(user_id)
      `)
      .order('created_at', { ascending: false })

    if (!error && data) {
      set({ trips: data as Trip[] })
    }
    set({ loading: false })
  },

  createTrip: async (name, description, currency) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data, error } = await supabase
      .from('trips')
      .insert({ name, description, currency, created_by: user.id })
      .select()
      .single()

    if (error || !data) {
      console.error('createTrip: insert failed', error)
      return null
    }

    // Add creator as admin member
    const { error: memberError } = await supabase.from('trip_members').insert({
      trip_id: data.id,
      user_id: user.id,
      role: 'admin',
    })
    if (memberError) {
      console.error('createTrip: failed to add creator as member', memberError)
      return null
    }

    set((state) => ({ trips: [data, ...state.trips] }))
    return data
  },
}))
