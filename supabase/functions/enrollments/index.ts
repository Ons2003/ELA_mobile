import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'npm:@supabase/supabase-js@2'

interface EnrollmentRequest {
  program_id: string
  user_data: {
    first_name: string
    last_name: string
    email: string
    phone?: string
    age?: number
    location?: string
    experience_level: string
    goals: string
    injuries?: string
    additional_info?: string
    is_women_only?: boolean
  }
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

const getClientIp = (req: Request) => {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0]?.trim() || 'unknown'
  }

  return (
    req.headers.get('cf-connecting-ip') ??
    req.headers.get('x-real-ip') ??
    'unknown'
  )
}

const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>()

class RateLimitError extends Error {
  retryAfterSeconds: number

  constructor(retryAfterMs: number) {
    super('Too many requests')
    this.name = 'RateLimitError'
    this.retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000))
  }
}

const assertRateLimit = (key: string, options?: { limit?: number; windowMs?: number }) => {
  const limit = options?.limit ?? 60
  const windowMs = options?.windowMs ?? 60_000
  const now = Date.now()
  const existing = rateLimitBuckets.get(key)

  if (!existing || now >= existing.resetAt) {
    rateLimitBuckets.set(key, { count: 1, resetAt: now + windowMs })
    return
  }

  if (existing.count >= limit) {
    throw new RateLimitError(existing.resetAt - now)
  }

  existing.count += 1
  rateLimitBuckets.set(key, existing)
}

const allowedMethods = ['POST', 'GET', 'PUT', 'OPTIONS']

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req, { methods: allowedMethods })

  if (req.method === 'OPTIONS') {
    return handleOptionsRequest(req, allowedMethods)
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const url = new URL(req.url)
    const pathSegments = url.pathname.split('/').filter(Boolean)

    // POST /enrollments - Create new enrollment
    if (req.method === 'POST') {
      const { program_id, user_data }: EnrollmentRequest = await req.json()
      assertRateLimit(`${getClientIp(req)}:enrollments:create:${user_data.email?.toLowerCase() ?? 'unknown'}`, {
        limit: 6,
        windowMs: 60_000,
      })

      if (!program_id || !user_data) {
        throw new Error('Program ID and user data are required')
      }

      // Check if program exists
      const { data: program, error: programError } = await supabaseClient
        .from('programs')
        .select('*')
        .eq('id', program_id)
        .single()

      if (programError || !program) {
        throw new Error('Program not found')
      }

      const normalizedEmail = user_data.email.trim().toLowerCase()

      const { data: matchingProfiles, error: profileLookupError } = await supabaseClient
        .from('profiles')
        .select('id')
        .eq('email', normalizedEmail)
        .limit(1)

      if (profileLookupError && profileLookupError.code !== 'PGRST116') {
        throw profileLookupError
      }

      const existingProfile = matchingProfiles?.[0] ?? null
      const userId = existingProfile?.id ?? null

      const { data: existingEnrollments, error: enrollmentLookupError } = await supabaseClient
        .from('program_enrollments')
        .select('id, status, user_id, is_women_only')
        .eq('program_id', program_id)
        .eq('lead_email', normalizedEmail)
        .limit(1)

      if (enrollmentLookupError && enrollmentLookupError.code !== 'PGRST116') {
        throw enrollmentLookupError
      }

      const rawAge = typeof user_data.age === 'number'
        ? user_data.age
        : parseInt(String(user_data.age ?? '').trim(), 10)
      const parsedAge = Number.isFinite(rawAge) ? rawAge : null
      const existingWomenOnly = existingEnrollments?.[0]?.is_women_only ?? null
      const wantsWomenOnly = user_data.is_women_only === true
        ? true
        : user_data.is_women_only === false
          ? false
          : Boolean(existingWomenOnly)

      const enrollmentNotes = `Age: ${parsedAge ?? user_data.age ?? 'Not provided'}
Women-only request: ${wantsWomenOnly ? 'Yes' : 'No'}
Goals: ${user_data.goals || 'None'}
Injuries: ${user_data.injuries || 'None'}
Additional: ${user_data.additional_info || 'None'}`.trim()

      if (existingEnrollments && existingEnrollments.length > 0) {
        const currentEnrollment = existingEnrollments[0]

        const { data: updatedEnrollment, error: updateError } = await supabaseClient
          .from('program_enrollments')
          .update({
            user_id: currentEnrollment.user_id ?? userId,
            lead_first_name: user_data.first_name,
            lead_last_name: user_data.last_name,
            lead_email: normalizedEmail,
            lead_phone: user_data.phone ?? null,
            lead_age: parsedAge,
            lead_location: user_data.location ?? null,
            lead_experience_level: user_data.experience_level ?? null,
            lead_goals: user_data.goals ?? null,
            lead_injuries: user_data.injuries ?? null,
            lead_additional_info: user_data.additional_info ?? null,
            is_women_only: wantsWomenOnly,
            notes: enrollmentNotes,
            updated_at: new Date().toISOString(),
          })
          .eq('id', currentEnrollment.id)
          .select(`
            *,
            program:programs(*),
            profile:profiles!program_enrollments_user_id_fkey(*)
          `)
          .single()

        if (updateError) throw updateError

        return new Response(
          JSON.stringify({
            enrollment: updatedEnrollment,
            current_participants: program.current_participants ?? null,
            message:
              currentEnrollment.status === 'active'
                ? 'You are already enrolled in this program.'
                : 'Your enrollment request is already on file. We have updated your details.',
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const { data: enrollment, error: enrollmentError } = await supabaseClient
        .from('program_enrollments')
        .insert({
          user_id: userId,
          program_id: program_id,
          status: 'pending',
          notes: enrollmentNotes,
          lead_first_name: user_data.first_name,
          lead_last_name: user_data.last_name,
          lead_email: normalizedEmail,
          lead_phone: user_data.phone ?? null,
          lead_age: parsedAge,
          lead_location: user_data.location ?? null,
          lead_experience_level: user_data.experience_level ?? null,
          lead_goals: user_data.goals ?? null,
          lead_injuries: user_data.injuries ?? null,
          lead_additional_info: user_data.additional_info ?? null,
          is_women_only: wantsWomenOnly,
        })
        .select(`
          *,
          program:programs(*),
          profile:profiles!program_enrollments_user_id_fkey(*)
        `)
        .single()

      if (enrollmentError) throw enrollmentError

      let updatedParticipants: number | null = null

      try {
        const nextCount = (program.current_participants ?? 0) + 1
        const { data: updatedProgram, error: participantError } = await supabaseClient
          .from('programs')
          .update({ current_participants: nextCount })
          .eq('id', program_id)
          .select('current_participants')
          .single()

        if (participantError) {
          console.error('Error updating program participant count:', participantError)
        } else {
          updatedParticipants = updatedProgram?.current_participants ?? nextCount
        }
      } catch (updateError) {
        console.error('Unexpected error updating participant count:', updateError)
      }

      // Get all admin users
      const { data: admins } = await supabaseClient
        .from('profiles')
        .select('id')
        .eq('role', 'admin')

      // Send notification to all admins
      if (admins && admins.length > 0) {
        const adminNotifications = admins.map(admin => ({
          user_id: admin.id,
          title: 'New Program Enrollment Request',
          message: `${user_data.first_name} ${user_data.last_name} has requested enrollment in ${program.title}`,
          type: 'program_update'
        }))

        await supabaseClient
          .from('notifications')
          .insert(adminNotifications)
      }

      // Also send a notification to the user
      await supabaseClient
        .from('notifications')
        .insert({
          user_id: userId,
          title: 'Enrollment Request Submitted',
          message: `Your enrollment request for ${program.title} has been submitted and is pending admin approval.`,
          type: 'program_update'
        })

      return new Response(
        JSON.stringify({
          enrollment,
          current_participants: updatedParticipants,
          message: 'Enrollment request submitted successfully. You will be contacted once approved.'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // GET /enrollments - Get user enrollments
    if (req.method === 'GET') {
      const authHeader = req.headers.get('Authorization')
      if (!authHeader) throw new Error('Authorization required')

      const { data: { user }, error: authError } = await supabaseClient.auth.getUser(
        authHeader.replace('Bearer ', '')
      )
      if (authError || !user) throw new Error('Invalid authorization')

      const { data: enrollments, error } = await supabaseClient
        .from('program_enrollments')
        .select(`
          *,
          program:programs(*),
          profile:profiles!program_enrollments_user_id_fkey(*)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error

      return new Response(
        JSON.stringify(enrollments),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // PUT /enrollments/:id - Update enrollment status (admin only)
    if (req.method === 'PUT' && pathSegments.length === 3) {
      const enrollmentId = pathSegments[2]
      const authHeader = req.headers.get('Authorization')
      if (!authHeader) throw new Error('Authorization required')

      const { data: { user }, error: authError } = await supabaseClient.auth.getUser(
        authHeader.replace('Bearer ', '')
      )
      if (authError || !user) throw new Error('Invalid authorization')

      // Check if user is admin
      const { data: profile } = await supabaseClient
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (profile?.role !== 'admin') {
        throw new Error('Admin access required')
      }

      const { status } = await req.json()
      
      const { data: updatedEnrollment, error } = await supabaseClient
        .from('program_enrollments')
        .update({ status })
        .eq('id', enrollmentId)
        .select(`
          *,
          program:programs(*),
          profile:profiles!program_enrollments_user_id_fkey(*)
        `)
        .single()

      if (error) throw error

      return new Response(
        JSON.stringify(updatedEnrollment),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Route not found' }),
      { 
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    const status = error instanceof RateLimitError ? 429 : 400
    const payload = error instanceof RateLimitError
      ? { error: 'Too many enrollment attempts. Please wait and try again.' }
      : { error: error.message }

    const retryHeader = error instanceof RateLimitError ? { 'Retry-After': String(error.retryAfterSeconds) } : {}

    return new Response(
      JSON.stringify(payload),
      { 
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json', ...retryHeader }
      }
    )
  }
})
