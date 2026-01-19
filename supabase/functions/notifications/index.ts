import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'npm:@supabase/supabase-js@2'

interface NotificationData {
  user_id?: string
  title: string
  message: string
  type: 'workout_reminder' | 'coach_feedback' | 'program_update' | 'payment' | 'achievement'
  action_url?: string
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

const allowedMethods = ['GET', 'POST', 'PUT', 'OPTIONS']

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

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Authorization required')

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    )
    if (authError || !user) throw new Error('Invalid authorization')

    const url = new URL(req.url)
    const pathSegments = url.pathname.split('/').filter(Boolean)

    // GET /notifications - Get user notifications
    if (req.method === 'GET') {
      const { data: notifications, error } = await supabaseClient
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error

      return new Response(
        JSON.stringify(notifications),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // POST /notifications - Create notification (admin only)
    if (req.method === 'POST') {
      // Check if user is admin
      const { data: profile } = await supabaseClient
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (profile?.role !== 'admin') {
        throw new Error('Admin access required')
      }

      const notificationData: NotificationData = await req.json()

      const { data: notification, error } = await supabaseClient
        .from('notifications')
        .insert({
          user_id: notificationData.user_id || user.id,
          title: notificationData.title,
          message: notificationData.message,
          type: notificationData.type,
          action_url: notificationData.action_url
        })
        .select()
        .single()

      if (error) throw error

      return new Response(
        JSON.stringify(notification),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // PUT /notifications/:id/read - Mark notification as read
    if (req.method === 'PUT' && pathSegments.length === 4 && pathSegments[3] === 'read') {
      const notificationId = pathSegments[2]

      const { data: notification, error } = await supabaseClient
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId)
        .eq('user_id', user.id)
        .select()
        .single()

      if (error) throw error

      return new Response(
        JSON.stringify(notification),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // PUT /notifications/read-all - Mark all notifications as read
    if (req.method === 'PUT' && pathSegments.length === 3 && pathSegments[2] === 'read-all') {
      const { error } = await supabaseClient
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false)

      if (error) throw error

      return new Response(
        JSON.stringify({ message: 'All notifications marked as read' }),
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
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
