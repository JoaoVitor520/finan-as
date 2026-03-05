export type TransactionType = 'income' | 'expense'
export type TransactionScope = 'individual' | 'joint'
export type GoalStatus = 'active' | 'completed' | 'cancelled'
export type GoalScope = 'individual' | 'joint'

export interface Profile {
  id: string
  name: string
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export interface Couple {
  id: string
  user1_id: string
  user2_id: string | null
  invite_code: string
  name: string
  created_at: string
}

export interface Category {
  id: string
  name: string
  icon: string
  color: string
  type: 'income' | 'expense' | 'both'
  is_default: boolean
  couple_id: string | null
  created_at: string
}

export interface Transaction {
  id: string
  user_id: string
  couple_id: string | null
  category_id: string | null
  type: TransactionType
  scope: TransactionScope
  amount: number
  description: string
  notes: string | null
  date: string
  receipt_url: string | null
  ai_analyzed: boolean
  ai_description: string | null
  created_at: string
  updated_at: string
  // joined
  category?: Category
  profile?: Profile
}

export interface Goal {
  id: string
  user_id: string | null
  couple_id: string | null
  scope: GoalScope
  title: string
  description: string | null
  target_amount: number
  current_amount: number
  deadline: string | null
  icon: string
  color: string
  status: GoalStatus
  created_at: string
  updated_at: string
}

export interface GoalContribution {
  id: string
  goal_id: string
  user_id: string
  amount: number
  notes: string | null
  created_at: string
}

export interface AiInsight {
  id: string
  couple_id: string | null
  user_id: string | null
  scope: TransactionScope
  content: string
  period_start: string
  period_end: string
  created_at: string
}

export interface DashboardStats {
  totalIncome: number
  totalExpenses: number
  balance: number
  jointIncome: number
  jointExpenses: number
  topCategories: { name: string; icon: string; color: string; total: number }[]
  recentTransactions: Transaction[]
  monthlyData: { month: string; income: number; expenses: number }[]
}
