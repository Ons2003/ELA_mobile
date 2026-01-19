import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "npm:@supabase/supabase-js@2"

interface ContactPayload {
  name: string
  email: string
  topic?: string
  message: string
}

const ALLOWED_ORIGINS = [
  "https://elyesliftacademy.com",
  "https://www.elyesliftacademy.com",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]

const buildCorsHeaders = (req: Request, options?: { methods?: string[] }) => {
  const methods = options?.methods ?? ["GET", "POST", "OPTIONS"]
  const origin = req.headers.get("Origin")
  const isAllowedOrigin = origin && ALLOWED_ORIGINS.includes(origin)
  const allowOrigin = isAllowedOrigin ? origin : "*"

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers":
      req.headers.get("Access-Control-Request-Headers") ??
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": methods.join(", "),
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
    "X-Frame-Options": "DENY",
    "Content-Security-Policy": "frame-ancestors 'none'",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  }
}

const handleOptionsRequest = (req: Request, methods?: string[]) =>
  new Response(null, {
    status: 204,
    headers: buildCorsHeaders(req, { methods }),
  })

const getClientIp = (req: Request) => {
  const forwarded = req.headers.get("x-forwarded-for")
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown"
  }

  return (
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-real-ip") ??
    "unknown"
  )
}

const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>()

class RateLimitError extends Error {
  retryAfterSeconds: number

  constructor(retryAfterMs: number) {
    super("Too many requests")
    this.name = "RateLimitError"
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

const allowedMethods = ["POST", "OPTIONS"]

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req, { methods: allowedMethods })

  if (req.method === "OPTIONS") {
    return handleOptionsRequest(req, allowedMethods)
  }

  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        {
          status: 405,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      )
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? ""
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Supabase environment variables are not configured")
    }

    const supabaseClient = createClient(supabaseUrl, serviceRoleKey)

    const payload = (await req.json()) as ContactPayload
    assertRateLimit(`${getClientIp(req)}:contact`, { limit: 10, windowMs: 60_000 })
    const name = payload.name?.trim()
    const email = payload.email?.trim()?.toLowerCase()
    const topic = payload.topic?.trim() || null
    const message = payload.message?.trim()

    if (!name || !email || !message) {
      throw new Error("Name, email, and message are required")
    }

    const { data, error } = await supabaseClient
      .from("contact")
      .insert({
        name,
        email,
        topic,
        message,
      })
      .select()
      .single()

    if (error) {
      throw new Error(error.message)
    }

    return new Response(
      JSON.stringify({ success: true, data }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    )
  } catch (error) {
    console.error("Error handling contact form submission:", error)
    const message = error instanceof Error ? error.message : "Unknown error"

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof RateLimitError
          ? "Too many submissions. Please wait a moment before trying again."
          : message,
      }),
      {
        status: error instanceof RateLimitError ? 429 : 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          ...(error instanceof RateLimitError ? { "Retry-After": String(error.retryAfterSeconds) } : {}),
        },
      },
    )
  }
})
