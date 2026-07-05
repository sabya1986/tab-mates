export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          name: string
          email: string
          avatar_url: string | null
          created_at: string
        }
        Insert: {
          id: string
          name: string
          email: string
          avatar_url?: string | null
          created_at?: string
        }
        Update: {
          name?: string
          email?: string
          avatar_url?: string | null
        }
        Relationships: []
      }
      trips: {
        Row: {
          id: string
          name: string
          description: string | null
          currency: string
          status: 'active' | 'settled' | 'archived'
          simplify_debts: boolean
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          currency?: string
          status?: 'active' | 'settled' | 'archived'
          simplify_debts?: boolean
          created_by: string
          created_at?: string
        }
        Update: {
          name?: string
          description?: string | null
          currency?: string
          status?: 'active' | 'settled' | 'archived'
        }
        Relationships: []
      }
      trip_members: {
        Row: {
          trip_id: string
          user_id: string
          role: 'admin' | 'member'
          joined_at: string
        }
        Insert: {
          trip_id: string
          user_id: string
          role?: 'admin' | 'member'
          joined_at?: string
        }
        Update: {
          role?: 'admin' | 'member'
        }
        Relationships: []
      }
      expenses: {
        Row: {
          id: string
          trip_id: string
          paid_by: string
          description: string
          category: string | null
          amount: number
          split_method: 'equal' | 'exact' | 'percentage' | 'shares'
          expense_date: string
          created_at: string
        }
        Insert: {
          id?: string
          trip_id: string
          paid_by: string
          description: string
          category?: string | null
          amount: number
          split_method?: 'equal' | 'exact' | 'percentage' | 'shares'
          expense_date?: string
          created_at?: string
        }
        Update: {
          paid_by?: string
          description?: string
          category?: string | null
          amount?: number
          split_method?: 'equal' | 'exact' | 'percentage' | 'shares'
          expense_date?: string
        }
        Relationships: []
      }
      expense_splits: {
        Row: {
          id: string
          expense_id: string
          user_id: string
          amount: number
          is_settled: boolean
        }
        Insert: {
          id?: string
          expense_id: string
          user_id: string
          amount: number
          is_settled?: boolean
        }
        Update: {
          amount?: number
          is_settled?: boolean
        }
        Relationships: []
      }
      payments: {
        Row: {
          id: string
          trip_id: string
          from_user: string
          to_user: string
          amount: number
          note: string | null
          payment_date: string
          created_at: string
        }
        Insert: {
          id?: string
          trip_id: string
          from_user: string
          to_user: string
          amount: number
          note?: string | null
          payment_date?: string
          created_at?: string
        }
        Update: {
          note?: string | null
        }
        Relationships: []
      }
      trip_invites: {
        Row: {
          id: string
          trip_id: string
          created_by: string
          token: string
          expires_at: string
          created_at: string
        }
        Insert: {
          id?: string
          trip_id: string
          created_by: string
          token?: string
          expires_at?: string
          created_at?: string
        }
        Update: Record<string, never>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      user_exists_with_email: {
        Args: { check_email: string }
        Returns: boolean
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

// Convenience types
export type User = Database['public']['Tables']['users']['Row']
export type Trip = Database['public']['Tables']['trips']['Row']
export type TripMember = Database['public']['Tables']['trip_members']['Row']
export type Expense = Database['public']['Tables']['expenses']['Row']
export type ExpenseSplit = Database['public']['Tables']['expense_splits']['Row']
export type Payment = Database['public']['Tables']['payments']['Row']
export type TripInvite = Database['public']['Tables']['trip_invites']['Row']
