import { z } from 'zod'
import { NextResponse } from 'next/server'

const uuid = z.string().uuid('Invalid id format.')
const myanmarPhone = z.string().regex(/^09\d{7,9}$/, 'Enter a valid Myanmar phone number (e.g. 09XXXXXXXXX).')
const staffUsername = z.string().regex(
  /^[a-zA-Z0-9._]{3,30}$/,
  'Username must be 3–30 characters: letters, numbers, dots, underscores only.'
)
const customerUsername = z.string().trim().min(2, 'Username must be at least 2 characters.').max(60, 'Username is too long.')
const password = z.string().min(8, 'Password must be at least 8 characters.').max(72, 'Password is too long.')
const customerPassword = z.string().min(6, 'Password must be at least 6 characters.').max(72, 'Password is too long.')
const safeText = (max: number) => z.string().trim().max(max, `Field exceeds ${max} characters.`)

const pointsAmount = z
  .number({ message: 'Must be a number.' })
  .int('Must be an integer.')
  .positive('Must be positive.')
  .max(1_000_000, 'Value is too large.')

const stockAmount = z
  .number({ message: 'Must be a number.' })
  .int('Must be an integer.')
  .nonnegative('Stock cannot be negative.')
  .max(1_000_000, 'Stock is too large.')

const hoursPlayed = z
  .number({ message: 'hours_played must be a number.' })
  .positive('hours_played must be positive.')
  .max(720, 'hours_played is too large.')
  .finite('hours_played must be finite.')

export const RegisterSchema = z.object({
  phone: myanmarPhone,
  username: customerUsername,
  password: customerPassword,
})

export const CustomersQuerySchema = z.object({
  phone: z
    .string()
    .max(20, 'Phone search is too long.')
    .regex(/^[0-9+\-\s]*$/, 'Phone search may only contain digits, +, -, and spaces.')
    .optional(),
})

export const CustomerPasswordResetSchema = z.object({ password }).strict()
export const CustomerProfileUpdateSchema = z
  .object({
    username: customerUsername.optional(),
    phone: myanmarPhone.optional(),
  })
  .strict()
  .refine((o) => o.username !== undefined || o.phone !== undefined, {
    message: 'No valid fields.',
  })

export const AddPointsSchema = z.object({
  customer_id: uuid,
  hours_played: hoursPlayed,
  note: safeText(500).nullish(),
})

export const RedeemSchema = z.object({ reward_id: uuid })

export const RedemptionActionSchema = z.object({
  action: z.enum(['cancel', 'approve', 'reject'], { message: 'Invalid action.' }),
  notes: safeText(500).nullish(),
})

export const RewardCreateSchema = z.object({
  name: safeText(100).min(1, 'Name is required.'),
  description: safeText(1000).nullish(),
  points_cost: pointsAmount,
  stock: stockAmount.nullish(),
})

export const RewardUpdateSchema = z
  .object({
    name: safeText(100).min(1).optional(),
    description: safeText(1000).nullish(),
    points_cost: pointsAmount.optional(),
    stock: stockAmount.nullish(),
    is_active: z.boolean({ message: 'is_active must be a boolean.' }).optional(),
  })
  .strict()
  .refine((o) => Object.keys(o).some((k) => (o as Record<string, unknown>)[k] !== undefined), {
    message: 'No valid fields.',
  })

export const StaffCreateSchema = z.object({
  username: staffUsername,
  password,
})

export const StaffPasswordUpdateSchema = z.object({ password }).strict()

export const IdParamSchema = z.object({ id: uuid })

export function badRequest(error: z.ZodError) {
  const first = error.issues[0]
  return NextResponse.json(
    {
      error: first?.message ?? 'Invalid input.',
      issues: error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      })),
    },
    { status: 400 }
  )
}

export async function parseJson(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    return undefined
  }
}
