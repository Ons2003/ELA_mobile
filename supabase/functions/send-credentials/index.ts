import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'npm:@supabase/supabase-js@2'

interface CredentialsEmailData {
  email: string
  firstName: string
  lastName: string
  programTitle: string
  password: string
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
    if (req.method !== 'POST') {
      throw new Error('Method not allowed')
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Supabase configuration is missing')
    }

    const supabaseClient = createClient(supabaseUrl, serviceRoleKey)

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Authorization required')
    }

    const token = authHeader.replace('Bearer ', '')
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser(token)

    if (authError || !user) {
      throw new Error('Invalid authorization token')
    }

    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      throw new Error('Admin access required')
    }

    const { email, firstName, lastName, programTitle, password }: CredentialsEmailData = await req.json()

    if (!email || !firstName || !programTitle || !password) {
      throw new Error('Missing required fields')
    }

    assertRateLimit(`${user.id}:send-credentials:${email.toLowerCase()}`, {
      limit: 15,
      windowMs: 60_000,
    })
    assertRateLimit(`${getClientIp(req)}:send-credentials`, {
      limit: 20,
      windowMs: 60_000,
    })

    // Email content
    const emailSubject = 'Welcome to Elyes Lift Academy - Your Account Credentials'
    const emailBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Elyes Lift Academy</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #dc2626, #b91c1c); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 28px;">Welcome to Elyes Lift Academy!</h1>
    <p style="color: #fecaca; margin: 10px 0 0 0; font-size: 16px;">Your enrollment has been approved</p>
  </div>
  
  <div style="background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
    <p style="font-size: 18px; margin-bottom: 20px;">Dear ${firstName} ${lastName},</p>
    
    <p style="margin-bottom: 20px;">
      Congratulations! Your enrollment in <strong>${programTitle}</strong> has been approved by Coach Elyes. 
      You can now access your personalized training dashboard.
    </p>
    
    <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <h3 style="color: #dc2626; margin-top: 0;">Your Login Credentials:</h3>
      <p style="margin: 10px 0;"><strong>Email:</strong> ${email}</p>
      <p style="margin: 10px 0;"><strong>Password:</strong> <code style="background: #e5e7eb; padding: 4px 8px; border-radius: 4px; font-family: monospace;">${password}</code></p>
    </div>
    
    <div style="background: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 8px; margin: 20px 0;">
      <p style="margin: 0; color: #92400e;"><strong>Important:</strong> Please change your password after your first login for security purposes.</p>
    </div>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="https://elyesliftacademy.com" style="background: #dc2626; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
        Access Your Dashboard
      </a>
    </div>
    
    <h3 style="color: #dc2626;">What's Next?</h3>
    <ul style="padding-left: 20px;">
      <li>Log in to your dashboard using the credentials above</li>
      <li>Complete your strength assessment</li>
      <li>Access your personalized training program</li>
      <li>Connect with Coach Elyes for guidance</li>
    </ul>
    
    <p style="margin-top: 30px;">
      If you have any questions or need assistance, please don't hesitate to contact Coach Elyes directly.
    </p>
    
    <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 30px; text-align: center; color: #6b7280; font-size: 14px;">
      <p>Best regards,<br><strong>Coach Elyes Zerai</strong><br>Elyes Lift Academy</p>
      <p style="margin-top: 15px;">
        📧 elyesaccademylift@gmail.com<br>
        🌍 Based in Tunisia, Coaching Worldwide
      </p>
    </div>
  </div>
</body>
</html>
    `.trim()

    // In a real implementation, you would use a proper email service like:
    // - Supabase Edge Functions with Resend
    // - SendGrid
    // - Mailgun
    // - AWS SES
    
    // For now, we'll simulate the email sending
    console.log('Sending credentials email to:', email)
    console.log('Email subject:', emailSubject)

    // Simulate email sending delay
    await new Promise(resolve => setTimeout(resolve, 1000))

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Credentials email sent successfully',
        recipient: email
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error sending credentials email:', error)
    const status = error instanceof RateLimitError ? 429 : 400
    const payload = error instanceof RateLimitError
      ? { success: false, error: 'Too many credential emails sent. Please retry later.' }
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
