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
          created_by: string
          updated_by: string
          created_at: string
          updated_at: string
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
      expense_history: {
        Row: {
          id: string
          expense_id: string
          description: string
          category: string | null
          amount: number
          paid_by: string
          split_method: 'equal' | 'exact' | 'percentage' | 'shares'
          expense_date: string
          changed_by: string
          changed_at: string
        }
        Insert: never
        Update: never
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
      bill_split_associations: {
        Row: {
          user_id: string
          phone_number: string
          person_name: string
          email: string | null
          line_type: 'voice' | 'data' | 'wearable'
          updated_at: string
        }
        Insert: {
          user_id: string
          phone_number: string
          person_name: string
          email?: string | null
          line_type: 'voice' | 'data' | 'wearable'
          updated_at?: string
        }
        Update: {
          person_name?: string
          email?: string | null
          line_type?: 'voice' | 'data' | 'wearable'
          updated_at?: string
        }
        Relationships: []
      }
      bill_splits: {
        Row: {
          id: string
          created_by: string
          billing_period: string
          bill_total: number | null
          computed_total: number
          reconciled: boolean
          raw_input: Json
          created_at: string
        }
        Insert: {
          id?: string
          created_by: string
          billing_period: string
          bill_total?: number | null
          computed_total: number
          reconciled?: boolean
          raw_input: Json
          created_at?: string
        }
        Update: Record<string, never>
        Relationships: []
      }
      bill_split_shares: {
        Row: {
          id: string
          bill_split_id: string
          person_name: string
          email: string
          lines_desc: string
          line_subtotal: number
          account_share: number
          amount_total: number
          sent_at: string | null
          send_error: string | null
        }
        Insert: {
          id?: string
          bill_split_id: string
          person_name: string
          email: string
          lines_desc: string
          line_subtotal: number
          account_share: number
          amount_total: number
          sent_at?: string | null
          send_error?: string | null
        }
        Update: {
          sent_at?: string | null
          send_error?: string | null
        }
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
export type ExpenseHistory = Database['public']['Tables']['expense_history']['Row']
export type ExpenseSplit = Database['public']['Tables']['expense_splits']['Row']
export type Payment = Database['public']['Tables']['payments']['Row']
export type TripInvite = Database['public']['Tables']['trip_invites']['Row']
export type BillSplitAssociation = Database['public']['Tables']['bill_split_associations']['Row']
export type BillSplit = Database['public']['Tables']['bill_splits']['Row']
export type BillSplitShare = Database['public']['Tables']['bill_split_shares']['Row']
