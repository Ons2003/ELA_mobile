import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'npm:@supabase/supabase-js@2'

interface AuthRequest {
  action: 'signup' | 'signin' | 'signout' | 'reset-password'
  email?: string
  password?: string
  userData?: any
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

const allowedMethods = ['POST', 'OPTIONS']

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

    const { action, email, password, userData }: AuthRequest = await req.json()

    assertRateLimit(
      `${getClientIp(req)}:auth:${action || 'unknown'}:${email ?? 'anonymous'}`,
      {
        limit: action === 'signin' ? 5 : 15,
        windowMs: 60_000,
      },
    )

    switch (action) {
      case 'signup':
        if (!email || !password) {
          throw new Error('Email and password are required')
        }

        const { data: signUpData, error: signUpError } = await supabaseClient.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: userData
        })

        if (signUpError) throw signUpError

        // Create profile
        if (signUpData.user) {
          const { error: profileError } = await supabaseClient
            .from('profiles')
            .insert({
              id: signUpData.user.id,
              email: signUpData.user.email,
              first_name: userData?.first_name,
              last_name: userData?.last_name,
              role: 'user',
              experience_level: userData?.experience_level || 'beginner'
            })

          if (profileError) throw profileError
        }

        return new Response(
          JSON.stringify({ 
            success: true,
            user: signUpData.user, 
            message: 'User created successfully' 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

      case 'signin':
        if (!email || !password) {
          throw new Error('Email and password are required')
        }

        // Use admin method to sign in user
        const { data: signInData, error: signInError } = await supabaseClient.auth.admin.generateLink({
          type: 'magiclink',
          email,
        })

        if (signInError) {
          // Fallback to regular sign in
          const { data: regularSignIn, error: regularError } = await supabaseClient.auth.signInWithPassword({
            email,
            password
          })
          
          if (regularError) throw regularError
          
          // Get user profile
          const { data: profile } = await supabaseClient
            .from('profiles')
            .select('role, first_name, last_name, email')
            .eq('id', regularSignIn.user.id)
            .single()

          return new Response(
            JSON.stringify({ 
              success: true,
              user: {
                id: regularSignIn.user.id,
                email: regularSignIn.user.email,
                role: regularSignIn.user.email === 'elyesaccademylift@gmail.com' ? 'admin' : (profile?.role || 'user'),
                name: profile ? `${profile.first_name} ${profile.last_name}` : '',
                hasAccess: true
              },
              session: regularSignIn.session 
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // For admin link generation, we need to verify password manually
        const { data: userCheck, error: userError } = await supabaseClient.auth.admin.getUserById(
          signInData.user?.id || ''
        )

        if (userError) {
          // Try to find user by email and verify password
          const { data: authUser, error: authError } = await supabaseClient.auth.signInWithPassword({
            email,
            password
          })
          
          if (authError) throw authError
          
          const { data: profile } = await supabaseClient
            .from('profiles')
            .select('role, first_name, last_name, email')
            .eq('id', authUser.user.id)
            .single()

          return new Response(
            JSON.stringify({ 
              success: true,
              user: {
                id: authUser.user.id,
                email: authUser.user.email,
                role: authUser.user.email === 'elyesaccademylift@gmail.com' ? 'admin' : (profile?.role || 'user'),
                name: profile ? `${profile.first_name} ${profile.last_name}` : '',
                hasAccess: true
              },
              session: authUser.session 
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Get user profile to check role
        const { data: profile } = await supabaseClient
          .from('profiles')
          .select('role, first_name, last_name, email')
          .eq('id', userCheck.user.id)
          .single()

        return new Response(
          JSON.stringify({ 
            success: true,
            user: {
              id: userCheck.user.id,
              email: userCheck.user.email,
              role: userCheck.user.email === 'elyesaccademylift@gmail.com' ? 'admin' : (profile?.role || 'user'),
              name: profile ? `${profile.first_name} ${profile.last_name}` : '',
              hasAccess: true
            }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

      case 'reset-password':
        if (!email) {
          throw new Error('Email is required')
        }

        const { error: resetError } = await supabaseClient.auth.resetPasswordForEmail(email)
        if (resetError) throw resetError

        return new Response(
          JSON.stringify({ 
            success: true,
            message: 'Password reset email sent' 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

      default:
        throw new Error('Invalid action')
    }
  } catch (error) {
    console.error('Auth function error:', error)
    const status = error instanceof RateLimitError ? 429 : 400
    const payload = error instanceof RateLimitError
      ? { success: false, error: 'Too many authentication attempts. Please wait and try again.' }
      : { success: false, error: error.message }
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
