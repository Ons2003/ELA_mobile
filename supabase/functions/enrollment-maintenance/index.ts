import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

const ALLOWED_ORIGINS = [
  'https://elyesliftacademy.com',
  'https://www.elyesliftacademy.com',
  'http://localhost:5173',
  'http://localhost:3002',
];

const resolveAllowedOrigin = (req: Request) => {
  const origin = req.headers.get('Origin');
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    return origin;
  }
  return ALLOWED_ORIGINS[0];
};

const buildCorsHeaders = (req: Request, methods?: string[]) => {
  const origin = resolveAllowedOrigin(req);
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': (methods ?? ['GET', 'POST', 'OPTIONS']).join(', '),
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
};

const handleOptionsRequest = (req: Request, methods?: string[]) =>
  new Response(null, {
    status: 204,
    headers: buildCorsHeaders(req, methods),
  });

const startOfDay = (value: Date) => {
  const copy = new Date(value);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req, ['POST', 'OPTIONS']);

  if (req.method === 'OPTIONS') {
    return handleOptionsRequest(req, ['POST', 'OPTIONS']);
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authorization required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const today = startOfDay(new Date());
    const { data: enrollments, error } = await supabaseClient
      .from('program_enrollments')
      .select(
        `
        *,
        program:programs(id, title, duration_weeks),
        profile:profiles(id, first_name, email)
      `,
      )
      .eq('user_id', user.id);

    if (error) throw error;

    const updates: any[] = [];
    let notificationsCreated = 0;

    for (const enrollment of enrollments ?? []) {
      const durationWeeks =
        Number(enrollment?.program?.duration_weeks ?? 0) > 0
          ? Number(enrollment.program.duration_weeks)
          : 4;

      const baseStart =
        enrollment.start_date ??
        enrollment.enrolled_at ??
        new Date().toISOString().split('T')[0];
      const startDate = startOfDay(new Date(baseStart));
      const storedEnd = enrollment.end_date ? startOfDay(new Date(enrollment.end_date)) : null;
      const computedEnd =
        storedEnd ??
        startOfDay(new Date(startDate.getTime() + durationWeeks * 7 * 24 * 60 * 60 * 1000));

      let nextStatus = enrollment.status;
      if (nextStatus === 'active' && computedEnd < today) {
        nextStatus = 'completed';
      }

      if (
        nextStatus !== enrollment.status ||
        !enrollment.start_date ||
        !enrollment.end_date
      ) {
        updates.push({
          id: enrollment.id,
          start_date: startDate.toISOString().split('T')[0],
          end_date: computedEnd.toISOString().split('T')[0],
          status: nextStatus,
          updated_at: new Date().toISOString(),
        });
      }

      const daysUntilEnd = Math.ceil(
        (computedEnd.getTime() - today.getTime()) / (24 * 60 * 60 * 1000)
      );
      if (daysUntilEnd <= 7 && daysUntilEnd >= 0) {
        const actionUrl = `https://elyesliftacademy.com/?page=programs&enrollment=${enrollment.id}`;
        const { data: existingReminder, error: reminderLookupError } = await supabaseClient
          .from('notifications')
          .select('id')
          .eq('user_id', user.id)
          .eq('action_url', actionUrl)
          .limit(1);

        if (reminderLookupError) {
          console.error('Reminder lookup error:', reminderLookupError);
        }

        if (!existingReminder || existingReminder.length === 0) {
          const { error: createReminderError } = await supabaseClient
            .from('notifications')
            .insert({
              user_id: user.id,
              title: `Program ending soon: ${enrollment.program?.title ?? 'Your program'}`,
              message: 'Renew now to keep access without interruption.',
              type: 'program_update',
              action_url: actionUrl,
            });

          if (createReminderError) {
            console.error('Error creating reminder notification:', createReminderError);
          } else {
            notificationsCreated += 1;
          }
        }
      }
    }

    if (updates.length > 0) {
      const { error: updateError } = await supabaseClient
        .from('program_enrollments')
        .upsert(updates, { onConflict: 'id' });

      if (updateError) {
        throw updateError;
      }
    }

    return new Response(
      JSON.stringify({
        updated: updates.length,
        notificationsCreated,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('enrollment-maintenance error:', error);
    return new Response(
      JSON.stringify({ error: error?.message ?? 'Unexpected error' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
