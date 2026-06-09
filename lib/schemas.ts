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

export const AdjustPointsSchema = z.object({
  customer_id: uuid,
  points_delta: z
    .number({ message: 'Must be a number.' })
    .int('Must be a whole number.')
    .min(-10_000, 'Adjustment cannot exceed 10,000 points.')
    .max(10_000, 'Adjustment cannot exceed 10,000 points.')
    .refine((v) => v !== 0, { message: 'Amount cannot be zero.' }),
  reason: z.string().trim().min(1, 'Reason is required.').max(500, 'Reason is too long.'),
})

export const RedeemSchema = z.object({ reward_id: uuid })

export const CreateBookingSchema = z.object({
  booking_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format.')
    .refine((val) => {
      const d = new Date(val)
      return !isNaN(d.getTime()) && val === d.toISOString().slice(0, 10)
    }, 'Invalid calendar date.'),
  slots: z
    .array(z.number().int().min(6, 'Invalid slot.').max(21, 'Invalid slot.'))
    .min(1, 'Select at least one slot.')
    .max(2, 'Maximum 2 slots per booking.')
    .refine((arr) => new Set(arr).size === arr.length, { message: 'Duplicate slots.' }),
  override_request: z.boolean().optional(),
})

export const AdminCreateBookingSchema = z
  .object({
    customer_id: uuid.optional(),
    guest_name: z.string().trim().max(100, 'Guest name is too long.').optional(),
    guest_phone: z.string().trim().max(20, 'Guest phone is too long.').optional(),
    booking_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format.')
      .refine((val) => {
        const d = new Date(val)
        return !isNaN(d.getTime()) && val === d.toISOString().slice(0, 10)
      }, 'Invalid calendar date.'),
    slots: z
      .array(z.number().int().min(6, 'Invalid slot.').max(21, 'Invalid slot.'))
      .min(1, 'Select at least one slot.')
      .max(2, 'Maximum 2 slots per booking.')
      .refine((arr) => new Set(arr).size === arr.length, { message: 'Duplicate slots.' }),
    deposit_total: z
      .number({ message: 'Deposit must be a number.' })
      .int('Deposit must be an integer.')
      .min(0, 'Deposit cannot be negative.')
      .max(500_000, 'Deposit is too large.'),
    deposit_received: z.boolean({ message: 'deposit_received must be a boolean.' }),
    source: z.enum(['phone', 'walk_in', 'other'], { message: 'Invalid source.' }),
    internal_notes: z.string().trim().max(1000, 'Notes are too long.').optional(),
  })
  .refine(
    (d) =>
      d.customer_id !== undefined ||
      (d.guest_name !== undefined && d.guest_name.trim().length > 0),
    { message: 'Link a customer or enter guest details.', path: ['customer_id'] }
  )

export const BookingActionSchema = z
  .object({
    action: z.enum(['cancel', 'confirm', 'unconfirm', 'close'], { message: 'Invalid action.' }),
  })
  .strict()

export const ClosureCreateSchema = z.object({
  closure_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date.'),
  hour_start: z.number().int().min(6).max(21).nullish(),
  reason: safeText(200).nullish(),
})

export const CmsPostSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(1, 'Slug is required.')
    .max(120)
    .regex(/^[a-z0-9-]+$/, 'Slug may contain only lowercase letters, numbers and hyphens.'),
  category: z.enum(['news', 'promotion', 'league', 'event'], { message: 'Invalid category.' }),
  title: safeText(200).min(1, 'Title is required.'),
  title_my: safeText(200).nullish(),
  excerpt: safeText(2000).nullish(),
  excerpt_my: safeText(2000).nullish(),
  source_url: safeText(2000).nullish(),
  manual_image_url: safeText(2000).nullish(),
  published: z.boolean().optional(),
})

export const RedemptionActionSchema = z.object({
  action: z.enum(['cancel', 'approve', 'reject'], { message: 'Invalid action.' }),
  notes: safeText(500).nullish(),
})

export const RewardCreateSchema = z.object({
  name: safeText(100).min(1, 'Name is required.'),
  name_my: safeText(100).nullish(),
  description: safeText(1000).nullish(),
  description_my: safeText(1000).nullish(),
  points_cost: pointsAmount,
  stock: stockAmount.nullish(),
})

export const RewardToggleSchema = z
  .object({ is_active: z.boolean({ message: 'is_active must be a boolean.' }) })
  .strict()

export const RewardUpdateSchema = z
  .object({
    name: safeText(100).min(1).optional(),
    name_my: safeText(100).nullish(),
    description: safeText(1000).nullish(),
    description_my: safeText(1000).nullish(),
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

export function serverError(detail?: string): NextResponse {
  if (detail) console.error('[server error]', detail)
  return NextResponse.json(
    {
      error: 'An unexpected error occurred',
      ...(process.env.NODE_ENV !== 'production' && detail ? { detail } : {}),
    },
    { status: 500 }
  )
}

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
