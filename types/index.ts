export type UserRole = 'customer' | 'admin'

export interface Profile {
  id: string
  phone: string
  username: string
  role: UserRole
  total_points: number
  created_at: string
}

export interface Reward {
  id: string
  name: string
  description: string | null
  points_cost: number
  stock: number | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export type TransactionType = 'earn' | 'redeem'

export interface PointTransaction {
  id: string
  customer_id: string
  points_delta: number
  transaction_type: TransactionType
  hours_played: number | null
  reward_id: string | null
  note: string | null
  created_by: string | null
  created_at: string
  reward?: { name: string }
  creator?: { username: string }
}
