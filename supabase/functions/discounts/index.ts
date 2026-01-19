import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'npm:@supabase/supabase-js@2'

const TOKEN_TTL_MINUTES = 10
const MONTHLY_LIMIT_DAYS = 30

const buildCorsHeaders = (req: Request, options?: { methods?: string[] }) => {
  const methods = options?.methods ?? ['GET', 'POST', 'OPTIONS']
  const origin = req.headers.get('Origin') || '*'
  const requestedHeaders = req.headers.get('Access-Control-Request-Headers')
  const allowHeaders = requestedHeaders || 'authorization, x-client-info, apikey, content-type, accept, origin, referer'

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': allowHeaders,
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

const jsonResponse = (body: unknown, req: Request, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...buildCorsHeaders(req), 'Content-Type': 'application/json' },
  })

const htmlResponse = (body: string, req: Request, status = 200) =>
  new Response(body, {
    status,
    headers: { ...buildCorsHeaders(req), 'Content-Type': 'text/html; charset=utf-8' },
  })

const toHex = (buffer: ArrayBuffer) =>
  Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')

const hashToken = async (token: string) => {
  const data = new TextEncoder().encode(token)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return toHex(digest)
}

const base64UrlEncode = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

const generateToken = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return base64UrlEncode(bytes)
}

const renderVerifyHtml = (payload: {
  valid: boolean
  message: string
  partner?: string
  coupon?: string
  userId?: string
}) => {
  const statusColor = payload.valid ? '#16a34a' : '#dc2626'
  const statusLabel = payload.valid ? 'VALID' : 'INVALID'
  const meta = payload.valid
    ? `<p><strong>Partner:</strong> ${payload.partner ?? ''}</p>
       <p><strong>Code:</strong> ${payload.coupon ?? ''}</p>
       <p><strong>User:</strong> ${payload.userId ?? ''}</p>`
    : ''
  return `<!doctype html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Discount Verification</title>
        <style>
          body { font-family: Arial, sans-serif; background: #f8fafc; color: #0f172a; padding: 32px; }
          .card { max-width: 420px; margin: 0 auto; background: #fff; border-radius: 18px; padding: 24px; box-shadow: 0 20px 40px rgba(15, 23, 42, 0.12); }
          .status { font-size: 28px; font-weight: 700; color: ${statusColor}; }
          .message { margin-top: 12px; font-size: 14px; color: #475569; }
          .meta { margin-top: 16px; font-size: 13px; color: #334155; line-height: 1.6; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="status">${statusLabel}</div>
          <div class="message">${payload.message}</div>
          ${meta ? `<div class="meta">${meta}</div>` : ''}
        </div>
      </body>
    </html>`
}

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req, { methods: ['GET', 'POST', 'OPTIONS'] })

  if (req.method === 'OPTIONS') {
    return handleOptionsRequest(req, ['GET', 'POST', 'OPTIONS'])
  }

  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  const url = new URL(req.url)
  const pathSegments = url.pathname.split('/').filter(Boolean)
  const lastSegment = pathSegments[pathSegments.length - 1]
  const isVerifyRoute = lastSegment === 'verify'

  if (req.method === 'GET' && isVerifyRoute) {
    const token = url.searchParams.get('token')
    if (!token) {
      return jsonResponse({ valid: false, message: 'Token is required.' }, req, 400)
    }

    const now = new Date().toISOString()
    const tokenHash = await hashToken(token)

    const { data: updated } = await supabaseClient
      .from('discount_tokens')
      .update({ redeemed_at: now, redeemed_by: req.headers.get('x-forwarded-for') ?? 'scanner' })
      .eq('token_hash', tokenHash)
      .is('redeemed_at', null)
      .gt('expires_at', now)
      .select('partner_name, coupon_code, user_id, expires_at, redeemed_at')
      .maybeSingle()

    if (updated) {
      const payload = {
        valid: true,
        message: 'Discount verified. Apply the offer for this user.',
        partner: updated.partner_name,
        coupon: updated.coupon_code,
        userId: updated.user_id,
      }
      const accept = req.headers.get('accept') ?? ''
      if (accept.includes('application/json')) {
        return jsonResponse(payload, req)
      }
      return htmlResponse(renderVerifyHtml(payload), req)
    }

    const { data: record } = await supabaseClient
      .from('discount_tokens')
      .select('partner_name, coupon_code, user_id, expires_at, redeemed_at')
      .eq('token_hash', tokenHash)
      .maybeSingle()

    let message = 'Token is invalid.'
    if (record?.redeemed_at) {
      message = 'Token already used.'
    } else if (record?.expires_at && record.expires_at <= now) {
      message = 'Token expired.'
    }

    const payload = { valid: false, message }
    const accept = req.headers.get('accept') ?? ''
    if (accept.includes('application/json')) {
      return jsonResponse(payload, req, 400)
    }
    return htmlResponse(renderVerifyHtml(payload), req, 400)
  }

  if (req.method === 'POST') {
    const body = await req.json().catch(() => null)
    const action = body?.action

    if (action !== 'create_token') {
      return jsonResponse({ error: 'Unsupported action.' }, req, 400)
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return jsonResponse({ error: 'Authorization required.' }, req, 401)
    }

    const { data: authData, error: authError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', ''),
    )
    if (authError || !authData?.user) {
      return jsonResponse({ error: 'Invalid authorization.' }, req, 401)
    }

    const partnerName = body?.payload?.partnerName
    const couponCode = body?.payload?.couponCode
    if (!partnerName || !couponCode) {
      return jsonResponse({ error: 'partnerName and couponCode are required.' }, req, 400)
    }

    const now = Date.now()
    const cutoff = new Date(now - MONTHLY_LIMIT_DAYS * 24 * 60 * 60 * 1000).toISOString()

    const { data: recentRedemption } = await supabaseClient
      .from('discount_tokens')
      .select('redeemed_at')
      .eq('user_id', authData.user.id)
      .eq('partner_name', partnerName)
      .not('redeemed_at', 'is', null)
      .gte('redeemed_at', cutoff)
      .order('redeemed_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (recentRedemption?.redeemed_at) {
      const nextAvailableAt = new Date(
        new Date(recentRedemption.redeemed_at).getTime() + MONTHLY_LIMIT_DAYS * 24 * 60 * 60 * 1000,
      ).toISOString()
      return jsonResponse(
        {
          error: 'Discount already used this month.',
          code: 'MONTHLY_LIMIT',
          nextAvailableAt,
        },
        req,
        429,
      )
    }

    const token = generateToken()
    const tokenHash = await hashToken(token)
    const expiresAt = new Date(now + TOKEN_TTL_MINUTES * 60 * 1000).toISOString()

    await supabaseClient
      .from('discount_tokens')
      .update({
        redeemed_at: new Date(now).toISOString(),
        redeemed_by: 'superseded',
        expires_at: new Date(now).toISOString(),
      })
      .eq('user_id', authData.user.id)
      .eq('partner_name', partnerName)
      .is('redeemed_at', null)

    const { error } = await supabaseClient.from('discount_tokens').insert({
      token_hash: tokenHash,
      user_id: authData.user.id,
      partner_name: partnerName,
      coupon_code: couponCode,
      expires_at: expiresAt,
    })

    if (error) {
      return jsonResponse({ error: 'Unable to create token.' }, req, 500)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const verifyUrl = `${supabaseUrl}/functions/v1/discounts/verify?token=${token}`

    return jsonResponse(
      {
        token,
        expiresAt,
        verifyUrl,
      },
      req,
    )
  }

  return new Response('Not found', { status: 404, headers: corsHeaders })
})
