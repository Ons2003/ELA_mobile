import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

const resolveAllowedOrigin = (req: Request) => {
  return (
    req.headers.get('Origin') ??
    req.headers.get('origin') ??
    'http://localhost:5173'
  );
};

const buildCorsHeaders = (req: Request, options?: { methods?: string[] }) => {
  const methods = options?.methods ?? ['GET', 'POST', 'OPTIONS'];
  const origin = resolveAllowedOrigin(req);

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
  };
};

const handleOptionsRequest = (req: Request, methods?: string[]) =>
  new Response(null, {
    status: 204,
    headers: buildCorsHeaders(req, { methods }),
  });

const getClientIp = (req: Request) => {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0]?.trim() || 'unknown';
  }
  return (
    req.headers.get('cf-connecting-ip') ??
    req.headers.get('x-real-ip') ??
    'unknown'
  );
};

const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();

class RateLimitError extends Error {
  retryAfterSeconds: number;

  constructor(retryAfterMs: number) {
    super('Too many requests');
    this.name = 'RateLimitError';
    this.retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
  }
}

const assertRateLimit = (key: string, options?: { limit?: number; windowMs?: number }) => {
  const limit = options?.limit ?? 200;
  const windowMs = options?.windowMs ?? 60_000;
  const now = Date.now();
  const existing = rateLimitBuckets.get(key);

  if (!existing || now >= existing.resetAt) {
    rateLimitBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }

  if (existing.count >= limit) {
    throw new RateLimitError(existing.resetAt - now);
  }

  existing.count += 1;
  rateLimitBuckets.set(key, existing);
};

const getRedirectBase = ()=>Deno.env.get('PUBLIC_APP_URL') ?? Deno.env.get('APP_URL') ?? Deno.env.get('SUPABASE_SITE_URL') ?? '';
const normalizeBaseUrl = (value)=>value.endsWith('/') ? value.slice(0, -1) : value;
const getAccountSetupRedirect = (base)=>base ? `${normalizeBaseUrl(base)}/?page=account-setup` : undefined;
const allowedMethods = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'];
serve(async (req)=>{
  const corsHeaders = buildCorsHeaders(req, { methods: allowedMethods });
  if (req.method === 'OPTIONS') {
    return handleOptionsRequest(req, allowedMethods);
  }
  try {
    const clientIp = getClientIp(req);
    assertRateLimit(`${clientIp}:admin:${req.method}`, { limit: 150, windowMs: 60_000 });
    const supabaseClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Authorization required');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) throw new Error('Invalid authorization');
    // Check if user is admin
    const { data: profile } = await supabaseClient.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'admin') {
      throw new Error('Admin access required');
    }
    const url = new URL(req.url);
    const pathSegments = url.pathname.split('/').filter(Boolean);
    const adminIndex = pathSegments.indexOf('admin');
    if (adminIndex === -1) {
      return new Response(JSON.stringify({
        error: 'Invalid admin route'
      }), {
        status: 404,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    const resource = pathSegments[adminIndex + 1] ?? '';
    const resourceId = pathSegments[adminIndex + 2] ?? '';
    const action = pathSegments[adminIndex + 3] ?? '';
    // GET /admin/dashboard - Get dashboard stats
    if (req.method === 'GET' && resource === 'dashboard') {
      // Get user count
      const { count: userCount } = await supabaseClient.from('profiles').select('*', {
        count: 'exact',
        head: true
      });
      // Get enrollment count
      const { count: enrollmentCount } = await supabaseClient.from('program_enrollments').select('*', {
        count: 'exact',
        head: true
      });
      // Get active program count
      const { count: programCount } = await supabaseClient.from('programs').select('*', {
        count: 'exact',
        head: true
      }).eq('is_active', true);
      // Get total revenue
      const { data: payments } = await supabaseClient.from('payment_records').select('amount').eq('status', 'completed');
      const totalRevenue = payments?.reduce((sum, payment)=>sum + payment.amount, 0) || 0;
      // Get recent enrollments
      const { data: recentEnrollments } = await supabaseClient.from('program_enrollments').select(`
          *,
          program:programs(*),
          profile:profiles!program_enrollments_user_id_fkey(*)
        `).order('created_at', {
        ascending: false
      }).limit(10);
      return new Response(JSON.stringify({
        stats: {
          totalUsers: userCount || 0,
          totalEnrollments: enrollmentCount || 0,
          activePrograms: programCount || 0,
          totalRevenue
        },
        recentEnrollments: recentEnrollments || []
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // GET /admin/users - Get all users
    if (req.method === 'GET' && resource === 'users') {
      const { data: users, error } = await supabaseClient.from('profiles').select('*').order('created_at', {
        ascending: false
      });
      if (error) throw error;
      return new Response(JSON.stringify(users), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // GET /admin/enrollments - Get all enrollments
    if (req.method === 'GET' && resource === 'enrollments') {
      const { data: enrollments, error } = await supabaseClient.from('program_enrollments').select(`
          *,
          program:programs(*),
          profile:profiles!program_enrollments_user_id_fkey(*)
        `).order('created_at', {
        ascending: false
      });
      if (error) throw error;
      return new Response(JSON.stringify(enrollments), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // POST /admin/coaches - create a new coach user
    if (resource === 'coaches' && req.method === 'POST') {
      const payload = await req.json();
      const email = String(payload?.email ?? '').trim().toLowerCase();
      const password = String(payload?.password ?? '').trim();
      const firstName = payload?.first_name ? String(payload.first_name).trim() : null;
      const lastName = payload?.last_name ? String(payload.last_name).trim() : null;
      const phone = payload?.phone ? String(payload.phone).trim() : null;
      if (!email || !password) {
        return new Response(JSON.stringify({
          error: 'Email and password are required.'
        }), {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      const existingUser = await supabaseClient.from('profiles').select('id').ilike('email', email).maybeSingle();
      if (existingUser.data?.id) {
        return new Response(JSON.stringify({
          error: 'A user with this email already exists.'
        }), {
          status: 409,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      const { data: createdUser, error: createError } = await supabaseClient.auth.admin.createUser({
        email,
        password,
        email_confirm: false,
        user_metadata: {
          first_name: firstName ?? undefined,
          last_name: lastName ?? undefined,
          role: 'coach'
        }
      });
      if (createError || !createdUser?.user) {
        console.error('Error creating coach:', createError);
        return new Response(JSON.stringify({
          error: createError?.message ?? 'Unable to create coach user.'
        }), {
          status: 500,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      const insertedProfile = await supabaseClient.from('profiles').update({
        email,
        first_name: firstName,
        last_name: lastName,
        phone,
        role: 'coach'
      }).eq('id', createdUser.user.id).select('*').single();
      if (insertedProfile.error) {
        console.error('Error updating coach profile:', insertedProfile.error);
        return new Response(JSON.stringify({
          error: insertedProfile.error.message ?? 'Coach created but profile update failed.'
        }), {
          status: 500,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      return new Response(JSON.stringify({
        user: createdUser.user,
        profile: insertedProfile.data
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // PUT /admin/coaches/:id/users - assign athletes to coach
    if (resource === 'coaches' && resourceId && action === 'users' && req.method === 'PUT') {
      const payload = await req.json();
      const userIds = Array.isArray(payload?.user_ids) ? payload.user_ids.filter((value)=>typeof value === 'string') : [];
      const coachId = resourceId;
      // Ensure coach exists
      const { data: coachProfile, error: coachError } = await supabaseClient.from('profiles').select('id, role').eq('id', coachId).single();
      if (coachError || !coachProfile) {
        return new Response(JSON.stringify({
          error: 'Coach not found.'
        }), {
          status: 404,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      if (coachProfile.role !== 'coach' && coachProfile.role !== 'admin') {
        return new Response(JSON.stringify({
          error: 'Target user is not a coach.'
        }), {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      // Clear existing athlete assignments
      const clearResponse = await supabaseClient.from('coach_user_assignments').delete().eq('coach_id', coachId);
      if (clearResponse.error) {
        console.error('Error clearing coach athlete assignments:', clearResponse.error);
        return new Response(JSON.stringify({
          error: clearResponse.error.message ?? 'Unable to clear existing assignments.'
        }), {
          status: 500,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      if (userIds.length > 0) {
        const rows = userIds.map((userId: string) => ({
          coach_id: coachId,
          user_id: userId
        }));
        const assignResponse = await supabaseClient.from('coach_user_assignments').insert(rows);
        if (assignResponse.error) {
          console.error('Error assigning athletes to coach:', assignResponse.error);
          return new Response(JSON.stringify({
            error: assignResponse.error.message ?? 'Unable to assign athletes.'
          }), {
            status: 500,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          });
        }
      }
      const { data: updatedAssignments } = await supabaseClient.from('coach_user_assignments').select('*').order('created_at', {
        ascending: false
      });
      return new Response(JSON.stringify({
        success: true,
        assignments: updatedAssignments ?? []
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Admin Programs Management
    if (resource === 'programs') {
      if (req.method === 'GET') {
        const { data: programs, error } = await supabaseClient.from('programs').select('*').order('created_at', {
          ascending: false
        });
        if (error) throw error;
        return new Response(JSON.stringify(programs ?? []), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      if (req.method === 'POST') {
        const payload = await req.json();
        const insertData = {
          title: payload.title,
          subtitle: payload.subtitle ?? null,
          description: payload.description ?? null,
          program_type: payload.program_type,
          level: payload.level,
          duration_weeks: payload.duration_weeks,
          price: payload.price,
          currency: payload.currency,
          image_url: payload.image_url ?? null,
          features: Array.isArray(payload.features) ? payload.features : [],
          is_popular: Boolean(payload.is_popular),
          is_active: Boolean(payload.is_active),
          max_participants: payload.max_participants ?? null,
          current_participants: payload.current_participants ?? 0
        };
        const { data, error } = await supabaseClient.from('programs').insert(insertData).select('*').single();
        if (error) throw error;
        return new Response(JSON.stringify(data), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      if (req.method === 'PUT' && resourceId) {
        const payload = await req.json();
        const updateData = {
          title: payload.title,
          subtitle: payload.subtitle ?? null,
          description: payload.description ?? null,
          program_type: payload.program_type,
          level: payload.level,
          duration_weeks: payload.duration_weeks,
          price: payload.price,
          currency: payload.currency,
          image_url: payload.image_url ?? null,
          features: Array.isArray(payload.features) ? payload.features : [],
          is_popular: Boolean(payload.is_popular),
          is_active: Boolean(payload.is_active),
          max_participants: payload.max_participants ?? null,
          current_participants: payload.current_participants ?? 0
        };
        const { data, error } = await supabaseClient.from('programs').update(updateData).eq('id', resourceId).select('*').single();
        if (error) throw error;
        return new Response(JSON.stringify(data), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      if (req.method === 'DELETE' && resourceId) {
        const { error } = await supabaseClient.from('programs').delete().eq('id', resourceId);
        if (error) throw error;
        return new Response(JSON.stringify({
          message: 'Program deleted successfully'
        }), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
    }
    // PUT /admin/enrollments/:id - Update enrollment status
    if (req.method === 'PUT' && resource === 'enrollments' && resourceId) {
      const enrollmentId = resourceId;
      const { status } = await req.json();
      const { data: enrollment, error } = await supabaseClient
        .from('program_enrollments')
        .update({ status })
        .eq('id', enrollmentId)
        .select(
          `
          *,
          program:programs(*),
          profile:profiles!program_enrollments_user_id_fkey(*)
        `,
        )
        .single();
      if (error) throw error;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      let updatedEnrollment = enrollment;

      if (status === 'active' && enrollment?.program) {
        const startDateIso =
          enrollment.start_date ??
          enrollment.enrolled_at ??
          new Date().toISOString().split('T')[0];
        const startDateObj = new Date(startDateIso);
        startDateObj.setHours(0, 0, 0, 0);
        const durationWeeks =
          Number(enrollment.program.duration_weeks ?? 0) > 0
            ? Number(enrollment.program.duration_weeks)
            : 4;
        const computedEnd = enrollment.end_date
          ? new Date(enrollment.end_date)
          : new Date(startDateObj.getTime() + durationWeeks * 7 * 24 * 60 * 60 * 1000);
        computedEnd.setHours(0, 0, 0, 0);

        let statusToPersist = status;
        if (computedEnd < today) {
          statusToPersist = 'completed';
        }

        if (
          statusToPersist !== enrollment.status ||
          enrollment.start_date !== startDateIso ||
          enrollment.end_date !== computedEnd.toISOString().split('T')[0]
        ) {
          const { data: datedEnrollment } = await supabaseClient
            .from('program_enrollments')
            .update({
              status: statusToPersist,
              start_date: startDateIso,
              end_date: computedEnd.toISOString().split('T')[0],
              updated_at: new Date().toISOString(),
            })
            .eq('id', enrollmentId)
            .select(
              `
              *,
              program:programs(*),
              profile:profiles!program_enrollments_user_id_fkey(*)
            `,
            )
            .single();
          if (datedEnrollment) {
            updatedEnrollment = datedEnrollment;
          }
        }
      }
      const redirectBase = getRedirectBase();
      const accountSetupRedirect = getAccountSetupRedirect(redirectBase);
      // Send invite email when the enrollment is approved
      let inviteStatus = 'skipped';
      let inviteError = null;
      const contactEmail = (enrollment?.profile?.email ?? enrollment?.lead_email ?? '').trim();
      const contactFirstName = enrollment?.profile?.first_name ?? enrollment?.lead_first_name ?? '';
      const contactLastName = enrollment?.profile?.last_name ?? enrollment?.lead_last_name ?? '';
      if (!contactEmail) {
        inviteStatus = 'missing_email';
      } else if (status === 'active') {
        const inviteOptions = {
          data: {
            first_name: contactFirstName,
            last_name: contactLastName,
            enrollment_id: enrollment.id,
            program_id: enrollment.program_id,
            program_title: enrollment.program?.title ?? ''
          }
        };
        if (accountSetupRedirect) {
          inviteOptions.redirectTo = accountSetupRedirect;
        }
        try {
          await supabaseClient.auth.admin.inviteUserByEmail(contactEmail, inviteOptions);
          inviteStatus = 'invite_sent';
        } catch (inviteErrorInstance) {
          console.error('Error sending enrollment invite email:', inviteErrorInstance);
          inviteStatus = 'failed';
          inviteError = inviteErrorInstance?.message ?? 'INVITE_FAILED';
          const errorMessage = String(inviteErrorInstance?.message ?? '');
          if (errorMessage.includes('already registered') || errorMessage.includes('already exists')) {
            try {
              await supabaseClient.auth.resetPasswordForEmail(contactEmail, {
                redirectTo: accountSetupRedirect
              });
              inviteStatus = 'password_reset_sent';
              inviteError = null;
            } catch (resetError) {
              console.error('Error sending fallback password reset email:', resetError);
              inviteError = resetError?.message ?? inviteError;
              inviteStatus = 'failed';
            }
          }
        }
      }
      // Send notification to user
      if (enrollment?.user_id) {
        await supabaseClient.from('notifications').insert({
          user_id: enrollment.user_id,
          title: 'Enrollment Status Updated',
          message: `Your enrollment in ${enrollment.program?.title} has been ${status}`,
          type: 'program_update'
        });
      }
        return new Response(JSON.stringify({
          ...updatedEnrollment,
          invite_status: inviteStatus,
          invite_error: inviteError
        }), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
    }
    // GET /admin/checkins - Get all workout check-ins
    if (req.method === 'GET' && resource === 'checkins') {
      const { data: checkins, error } = await supabaseClient.from('workout_checkins').select(`
          *,
          workout:workouts(*),
          profile:profiles(*),
          media:workout_checkin_media(*)
        `).order('created_at', {
        ascending: false
      });
      if (error) throw error;
      return new Response(JSON.stringify(checkins ?? []), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // PUT /admin/checkins/:id - Update check-in status/notes
    if (req.method === 'PUT' && resource === 'checkins' && resourceId) {
      const checkinId = resourceId;
      const { status, coach_notes } = await req.json();
      const { data: updatedCheckin, error } = await supabaseClient.from('workout_checkins').update({
        status,
        coach_notes,
        updated_at: new Date().toISOString()
      }).eq('id', checkinId).select(`
          *,
          workout:workouts(*),
          profile:profiles(*),
          media:workout_checkin_media(*)
        `).single();
      if (error) throw error;
      if (updatedCheckin?.profile) {
        const notificationType = status === 'needs_revision' ? 'checkin_followup' : 'checkin_update';
        const notificationMessage = status === 'needs_revision' ? 'Coach requested an update on your latest check-in.' : 'Your recent check-in has been reviewed.';
        await supabaseClient.from('notifications').insert({
          user_id: updatedCheckin.profile.id,
          title: 'Check-in Update',
          message: notificationMessage,
          type: notificationType,
          action_url: updatedCheckin.workout ? `/dashboard?workout=${updatedCheckin.workout.id}` : null
        });
      }
      return new Response(JSON.stringify(updatedCheckin), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // POST /admin/users/:id/invite - Send account setup email
    if (req.method === 'POST' && resource === 'users' && resourceId && action === 'invite') {
      const userId = resourceId;
      const { data: targetProfile, error: profileError } = await supabaseClient.from('profiles').select('id, email, first_name, last_name').eq('id', userId).single();
      if (profileError) {
        return new Response(JSON.stringify({
          error: profileError.message
        }), {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      if (!targetProfile?.email) {
        return new Response(JSON.stringify({
          error: 'Profile is missing an email address.',
          invite_status: 'missing_email'
        }), {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      const redirectBase = getRedirectBase();
      const accountSetupRedirect = getAccountSetupRedirect(redirectBase);
      let inviteStatus = 'invite_sent';
      let inviteError = null;
      try {
        const inviteOptions = {
          data: {
            first_name: targetProfile.first_name ?? '',
            last_name: targetProfile.last_name ?? '',
            manual_invite: true
          }
        };
        if (accountSetupRedirect) {
          inviteOptions.redirectTo = accountSetupRedirect;
        }
        await supabaseClient.auth.admin.inviteUserByEmail(targetProfile.email, inviteOptions);
      } catch (error) {
        inviteStatus = 'failed';
        const message = error instanceof Error ? error.message : 'INVITE_FAILED';
        inviteError = message;
        console.error('Error sending manual invite email:', error);
        const errorMessage = error instanceof Error ? error.message : '';
        if (errorMessage.includes('already registered') || errorMessage.includes('already exists')) {
          try {
            await supabaseClient.auth.resetPasswordForEmail(targetProfile.email, {
              redirectTo: accountSetupRedirect
            });
            inviteStatus = 'password_reset_sent';
            inviteError = null;
          } catch (resetError) {
            console.error('Error sending manual password reset email:', resetError);
            inviteError = resetError instanceof Error ? resetError.message : inviteError;
          }
        }
      }
      return new Response(JSON.stringify({
        invite_status: inviteStatus,
        invite_error: inviteError
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // DELETE /admin/users/:id - Delete user
    if (req.method === 'DELETE' && resource === 'users' && resourceId) {
      const userId = resourceId;
      // Delete user from auth
      const { error: authError } = await supabaseClient.auth.admin.deleteUser(userId);
      if (authError) throw authError;
      return new Response(JSON.stringify({
        message: 'User deleted successfully'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // POST /admin/broadcast - Send broadcast notification
    if (req.method === 'POST' && resource === 'broadcast') {
      const { title, message, type, user_ids } = await req.json();
      if (user_ids && user_ids.length > 0) {
        // Send to specific users
        const notifications = user_ids.map((userId)=>({
            user_id: userId,
            title,
            message,
            type
          }));
        const { error } = await supabaseClient.from('notifications').insert(notifications);
        if (error) throw error;
      } else {
        // Send to all users
        const { data: users } = await supabaseClient.from('profiles').select('id');
        if (users && users.length > 0) {
          const notifications = users.map((user)=>({
              user_id: user.id,
              title,
              message,
              type
            }));
          const { error } = await supabaseClient.from('notifications').insert(notifications);
          if (error) throw error;
        }
      }
      return new Response(JSON.stringify({
        message: 'Broadcast sent successfully'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    return new Response(JSON.stringify({
      error: 'Route not found'
    }), {
      status: 404,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    const isRateLimited = error instanceof RateLimitError;
    const status = isRateLimited ? 429 : 400;
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status,
      headers: {
        ...corsHeaders,
        ...(isRateLimited ? { 'Retry-After': String(error.retryAfterSeconds) } : {}),
        'Content-Type': 'application/json'
      }
    });
  }
});
