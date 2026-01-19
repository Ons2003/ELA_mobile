import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'npm:@supabase/supabase-js@2'

interface AssessmentData {
  squat_max?: number
  bench_max?: number
  deadlift_max?: number
  overhead_press_max?: number
  bodyweight_at_assessment?: number
  goals: string[]
  limitations?: string
  overall_level?: string
  recommended_programs: string[]
}

interface StrengthStandards {
  [key: string]: {
    untrained: number
    novice: number
    intermediate: number
    advanced: number
    elite: number
  }
}

const strengthStandards: StrengthStandards = {
  male: {
    untrained: 0.5,
    novice: 0.75,
    intermediate: 1.25,
    advanced: 1.75,
    elite: 2.25
  },
  female: {
    untrained: 0.4,
    novice: 0.6,
    intermediate: 1.0,
    advanced: 1.4,
    elite: 1.8
  }
}

function calculateStrengthLevel(lift: number, bodyweight: number, gender: string): string {
  const ratio = lift / bodyweight
  const standards = strengthStandards[gender]
  
  if (ratio >= standards.elite) return 'elite'
  if (ratio >= standards.advanced) return 'advanced'
  if (ratio >= standards.intermediate) return 'intermediate'
  if (ratio >= standards.novice) return 'novice'
  return 'beginner'
}

function getRecommendedPrograms(overallLevel: string, goals: string[]): string[] {
  const programRecommendations: { [key: string]: string[] } = {
    beginner: ['start-powerlifting', 'general-fitness'],
    novice: ['improve-squat', 'bench-program', 'start-powerlifting'],
    intermediate: ['improve-squat', 'bench-program', 'deadlift-program', 'competition-prep-8'],
    advanced: ['competition-prep-8', 'competition-prep-16', 'powerlifting-mastery'],
    elite: ['competition-prep-16', 'elite-coaching', 'powerlifting-mastery']
  }

  return programRecommendations[overallLevel] || ['start-powerlifting']
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
  new Response('ok', {
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

const allowedMethods = ['POST', 'GET', 'OPTIONS']

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

    // POST /assessments - Create new assessment
    if (req.method === 'POST') {
      const assessmentData: AssessmentData & {
        user_id?: string | null
        gender: string
        bodyweight: number
      } = await req.json()

      assertRateLimit(`${getClientIp(req)}:assessments:create`, { limit: 25, windowMs: 60_000 })

      let authenticatedUserId: string | null = null
      const token = req.headers.get('Authorization')?.replace('Bearer ', '')

      if (token) {
        const {
          data: { user },
          error: authError,
        } = await supabaseClient.auth.getUser(token)

        if (!authError && user) {
          authenticatedUserId = user.id
        }
      }

      if (assessmentData.user_id && authenticatedUserId && assessmentData.user_id !== authenticatedUserId) {
        throw new Error('You cannot submit an assessment for another user.')
      }

      // Calculate overall strength level
      const { squat_max = 0, bench_max = 0, deadlift_max = 0, gender, bodyweight } = assessmentData
      
      let overallLevel = 'beginner'
      if (squat_max > 0 && bench_max > 0 && deadlift_max > 0) {
        const squatLevel = calculateStrengthLevel(squat_max, bodyweight, gender)
        const benchLevel = calculateStrengthLevel(bench_max, bodyweight, gender)
        const deadliftLevel = calculateStrengthLevel(deadlift_max, bodyweight, gender)
        
        // Use the most common level
        const levels = [squatLevel, benchLevel, deadliftLevel]
        const levelCounts = levels.reduce((acc, level) => {
          acc[level] = (acc[level] || 0) + 1
          return acc
        }, {} as Record<string, number>)
        
        overallLevel = Object.keys(levelCounts).reduce((a, b) => 
          levelCounts[a] > levelCounts[b] ? a : b
        )
      }

      // Get program recommendations
      const recommendedPrograms = getRecommendedPrograms(overallLevel, assessmentData.goals)

      const assessmentRecord = {
        user_id: authenticatedUserId ?? null,
        squat_max: assessmentData.squat_max,
        bench_max: assessmentData.bench_max,
        deadlift_max: assessmentData.deadlift_max,
        overhead_press_max: assessmentData.overhead_press_max,
        bodyweight_at_assessment: assessmentData.bodyweight_at_assessment,
        assessment_date: new Date().toISOString().split('T')[0],
        goals: assessmentData.goals,
        limitations: assessmentData.limitations,
        overall_level: overallLevel,
        recommended_programs: recommendedPrograms
      }

      const { data: assessment, error } = await supabaseClient
        .from('strength_assessments')
        .insert(assessmentRecord)
        .select()
        .single()

      if (error) throw error

      // Get recommended program details
      const { data: programs } = await supabaseClient
        .from('programs')
        .select('*')
        .in('id', recommendedPrograms)

      return new Response(
        JSON.stringify({
          assessment,
          recommended_programs: programs || [],
          overall_level: overallLevel
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // GET /assessments - Get user assessments
    if (req.method === 'GET') {
      const authHeader = req.headers.get('Authorization')
      if (!authHeader) throw new Error('Authorization required')

      const { data: { user }, error: authError } = await supabaseClient.auth.getUser(
        authHeader.replace('Bearer ', '')
      )
      if (authError || !user) throw new Error('Invalid authorization')

      const { data: assessments, error } = await supabaseClient
        .from('strength_assessments')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error

      return new Response(
        JSON.stringify(assessments),
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
    const body = error instanceof RateLimitError
      ? { error: 'Too many assessment submissions. Please wait and try again.' }
      : { error: error.message }

    const extraHeaders = error instanceof RateLimitError
      ? { 'Retry-After': String(error.retryAfterSeconds) }
      : {}

    return new Response(
      JSON.stringify(body),
      {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json', ...extraHeaders }
      }
    )
  }
})
