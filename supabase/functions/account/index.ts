import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'npm:@supabase/supabase-js@2'

type AccountAction = 'summary' | 'delete'

interface AccountRequest {
  action?: AccountAction
}

const estimateDataFootprint = (params: {
  workouts: number
  enrollments: number
  checkIns: number
  notifications: number
}): number => {
  const baseProfileBytes = 2048
  const perWorkoutBytes = 1024
  const perEnrollmentBytes = 768
  const perCheckInBytes = 640
  const perNotificationBytes = 320

  return Math.round(
    baseProfileBytes +
    params.workouts * perWorkoutBytes +
    params.enrollments * perEnrollmentBytes +
    params.checkIns * perCheckInBytes +
    params.notifications * perNotificationBytes
  )
}

const ALLOWED_ORIGINS = [
  'https://elyesliftacademy.com',
  'https://www.elyesliftacademy.com',
  'http://localhost:5173',
]

const resolveAllowedOrigin = (req: Request) => {
  const origin = req.headers.get('Origin')
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    return origin
  }
  return ALLOWED_ORIGINS[0]
}

const buildCorsHeaders = (req: Request, options?: { methods?: string[] }) => {
  const methods = options?.methods ?? ['GET', 'POST', 'OPTIONS']
  const origin = resolveAllowedOrigin(req)

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': methods.join(', '),
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
    'X-Frame-Options': 'DENY',
    'Content-Security-Policy': "frame-ancestors 'none'",
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  }
}

const handleOptionsRequest = (req: Request, methods?: string[]) =>
  new Response(null, {
    status: 204,
    headers: buildCorsHeaders(req, { methods }),
  })

const allowedMethods = ['POST', 'OPTIONS']

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req, { methods: allowedMethods })

  if (req.method === 'OPTIONS') {
    return handleOptionsRequest(req, allowedMethods)
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const {
      data: { user },
      error: authError
    } = await supabaseClient.auth.getUser(authHeader.replace('Bearer ', ''))

    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid authorization token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let payload: AccountRequest | null = null
    try {
      payload = await req.json()
    } catch {
      // ignore JSON parse error - handled below
    }

    if (!payload?.action) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing action' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (payload.action === 'summary') {
      const [workouts, enrollments, checkIns, notifications] = await Promise.all([
        supabaseClient
          .from('workouts')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id),
        supabaseClient
          .from('program_enrollments')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id),
        supabaseClient
          .from('workout_checkins')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id),
        supabaseClient
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id),
      ])

      const summary = {
        lastLogin: user.last_sign_in_at ?? null,
        accountCreated: user.created_at ?? null,
        totalWorkouts: workouts.count ?? 0,
        totalEnrollments: enrollments.count ?? 0,
        totalCheckIns: checkIns.count ?? 0,
        totalNotifications: notifications.count ?? 0,
        approximateDataSize: estimateDataFootprint({
          workouts: workouts.count ?? 0,
          enrollments: enrollments.count ?? 0,
          checkIns: checkIns.count ?? 0,
          notifications: notifications.count ?? 0,
        }),
      }

      return new Response(
        JSON.stringify({ success: true, summary }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (payload.action === 'delete') {
      const { error: deleteError } = await supabaseClient.auth.admin.deleteUser(user.id)
      if (deleteError) throw deleteError

      return new Response(
        JSON.stringify({ success: true, message: 'Account deleted successfully' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Unsupported action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Account function error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error?.message ?? 'Unexpected error' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
