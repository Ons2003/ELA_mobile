import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6.9.11";

type Action = 'request' | 'propose_slots' | 'select_slot' | 'deny';

type RequestPayload = {
  action: Action;
  requestedDate?: string;
  sessionType?: string;
  sessionDetails?: string;
  appointmentId?: string;
  slots?: string[];
  selectedSlot?: string;
};

const PHYSICIAN_REQUEST_PREFIX = '[PHYSICIAN_REQUEST]';
const PHYSICIAN_RESPONSE_PREFIX = '[PHYSICIAN_RESPONSE]';

const ALLOWED_ORIGINS = [
  'https://elyesliftacademy.com',
  'https://www.elyesliftacademy.com',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

const buildCorsHeaders = (req: Request, options?: { methods?: string[] }) => {
  const methods = options?.methods ?? ['POST', 'OPTIONS'];
  const origin = req.headers.get('Origin');
  const isAllowed = origin && ALLOWED_ORIGINS.includes(origin);
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin! : '*',
    'Access-Control-Allow-Headers':
      req.headers.get('Access-Control-Request-Headers') ?? 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': methods.join(', '),
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
    'X-Frame-Options': 'DENY',
    'Content-Security-Policy': "frame-ancestors 'none'",
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
  };
};

const handleOptions = (req: Request, methods?: string[]) =>
  new Response(null, { status: 204, headers: buildCorsHeaders(req, { methods }) });

const buildTransporter = () => {
  const host = Deno.env.get('SMTP_HOST');
  const port = Number(Deno.env.get('SMTP_PORT') ?? 465);
  const user = Deno.env.get('SMTP_USER');
  const pass = Deno.env.get('SMTP_PASS');
  if (!host || !user || !pass) {
    throw new Error('SMTP credentials are not configured');
  }
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
};

const sendEmail = async (options: { to: string; subject: string; text: string; html?: string }) => {
  const transporter = buildTransporter();
  const from = Deno.env.get('SMTP_FROM') ?? Deno.env.get('SMTP_USER') ?? 'no-reply@elyesliftacademy.com';
  await transporter.sendMail({ from, ...options });
};

const formatDateLabel = (value?: string | null) => {
  if (!value) return 'Date not provided';
  const [yearStr, monthStr, dayStr] = value.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  if (!year || !month || !day) {
    return value;
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
};

const normalizeSlots = (slots?: string[] | null) =>
  [...(slots ?? [])]
    .map((slot) => slot.trim())
    .filter((slot) => slot.length > 0)
    .sort();

const haveDifferentSlots = (current?: string[] | null, next?: string[]) => {
  const normalizedCurrent = normalizeSlots(current);
  const normalizedNext = normalizeSlots(next);
  if (normalizedCurrent.length !== normalizedNext.length) {
    return true;
  }
  return normalizedCurrent.some((value, index) => value !== normalizedNext[index]);
};

const getFunctionsBaseUrl = () => {
  const supabaseUrl = (Deno.env.get('SUPABASE_URL') ?? '').replace(/\/$/, '');
  if (!supabaseUrl) {
    return '';
  }
  if (supabaseUrl.includes('.supabase.co')) {
    return supabaseUrl.replace('.supabase.co', '.functions.supabase.co');
  }
  return `${supabaseUrl}/functions/v1`;
};

const buildSlotButtonsHtml = (appointmentId: string, slots: string[]) => {
  const base = getFunctionsBaseUrl();
  return slots
    .map((slot) => {
      const link = `${base}/physician-appointments?action=select_slot_external&appointmentId=${appointmentId}&slot=${encodeURIComponent(slot)}`;
      return `<a href="${link}" style="display:inline-block;margin:4px 4px 0 0;padding:10px 14px;border-radius:8px;background:#16a34a;color:#fff;text-decoration:none;font-weight:bold;">${slot}</a>`;
    })
    .join('');
};

const sendPartnerAppointmentEmail = async (appointment: any, slots: string[]) => {
  const dateLabel = formatDateLabel(appointment.requested_date);
  const slotsList = slots.map((slot) => `- ${slot}`).join('\n');
  const slotButtons = buildSlotButtonsHtml(appointment.id, slots);
  const athleteName = `${appointment.user?.first_name ?? ''} ${appointment.user?.last_name ?? ''}`.trim() || 'Athlete';
  const emailContent = `Request approved from ELA coach desk.

Requested date: ${dateLabel}
Session type: ${appointment.session_type ?? 'Session'}
Details: ${appointment.session_details ?? 'Not provided'}
Slots offered:
${slotsList}
Athlete: ${athleteName}
Email: ${appointment.user?.email ?? 'Not provided'}
Phone: ${appointment.user?.phone ?? 'Not provided'}

Please select a time slot to finalize scheduling for this athlete.`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 640px;">
      <h2 style="margin-bottom: 12px;">Physician appointment request</h2>
      <p>${emailContent.replace(/\n/g, '<br/>')}</p>
      <div style="margin-top:16px; display:flex; gap:8px; flex-wrap: wrap;">${slotButtons}</div>
    </div>
  `;

  await sendEmail({
    to: 'onsouenniche6@gmail.com',
    subject: `Physician appointment request - ${dateLabel}`,
    text: emailContent,
    html,
  });
};

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req, { methods: ['GET', 'POST', 'OPTIONS'] });
  if (req.method === 'OPTIONS') return handleOptions(req, ['GET', 'POST', 'OPTIONS']);

  // Public slot selection link for physicians (no auth)
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const action = url.searchParams.get('action');
    if (action === 'select_slot_external') {
      const appointmentId = url.searchParams.get('appointmentId');
      const selectedSlot = url.searchParams.get('slot');
      if (!appointmentId || !selectedSlot) {
        return new Response('Missing appointmentId or slot.', { status: 400, headers: corsHeaders });
      }

      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
        const supabase = createClient(supabaseUrl, serviceRoleKey);

        const { data: existingAppointment, error: existingError } = await supabase
          .from('physician_appointments')
          .select('*, coach:profiles!physician_appointments_coach_id_fkey(*), user:profiles!physician_appointments_user_id_fkey(*)')
          .eq('id', appointmentId)
          .single();
        if (existingError || !existingAppointment) {
          return new Response('Appointment not found.', { status: 404, headers: corsHeaders });
        }
        if (existingAppointment.status === 'slot_selected' && existingAppointment.selected_slot) {
          return new Response(
            `<html><body style="font-family:Arial,sans-serif;"><h3>Slot already confirmed</h3><p>${formatDateLabel(existingAppointment.requested_date)} • ${existingAppointment.selected_slot}</p></body></html>`,
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'text/html' } },
          );
        }

        const { data: appointment, error } = await supabase
          .from('physician_appointments')
          .update({
            status: 'slot_selected',
            selected_slot: selectedSlot,
            approved_at: new Date().toISOString(),
          })
          .eq('id', appointmentId)
          .select('*, coach:profiles!physician_appointments_coach_id_fkey(*), user:profiles!physician_appointments_user_id_fkey(*)')
          .single();
        if (error || !appointment) {
          return new Response('Appointment not found or could not update.', { status: 400, headers: corsHeaders });
        }

        if (appointment.coach_id) {
          const athleteName = `${appointment.user?.first_name ?? ''} ${appointment.user?.last_name ?? ''}`.trim() || 'Athlete';
          const payload = {
            id: appointment.id,
            status: 'slot_selected',
            requestedDate: appointment.requested_date,
            dateLabel: formatDateLabel(appointment.requested_date),
            sessionType: appointment.session_type,
            sessionDetails: appointment.session_details,
            selectedSlot,
            athlete: {
              id: appointment.user_id,
              name: athleteName,
              email: appointment.user?.email,
              phone: appointment.user?.phone,
              program: appointment.user?.program_title,
            },
            createdAt: new Date().toISOString(),
            decidedAt: new Date().toISOString(),
          };
          await supabase.from('coach_messages').insert({
            sender_id: appointment.user_id,
            receiver_id: appointment.coach_id,
            sender_role: 'athlete',
            message: `${PHYSICIAN_RESPONSE_PREFIX} ${JSON.stringify(payload)}`,
          });
        }

        await supabase.from('workouts').insert({
          title: 'Physician Appointment',
          user_id: appointment.user_id,
          scheduled_date: appointment.requested_date,
          description: `Physician slot ${selectedSlot} • be on time`,
        });

        const text = `Physician confirmed a slot.\n\nDate: ${appointment.requested_date}\nSlot: ${selectedSlot}\nSession type: ${appointment.session_type}\nAthlete: ${appointment.user?.first_name ?? ''} ${appointment.user?.last_name ?? ''}\nEmail: ${appointment.user?.email ?? 'N/A'}\nPhone: ${appointment.user?.phone ?? 'N/A'}`;

        const recipients = [
          appointment.user?.email,
          appointment.coach?.email,
          'onsouenniche6@gmail.com',
        ].filter((v): v is string => Boolean(v));

        await Promise.all(
          recipients.map((to) =>
            sendEmail({
              to,
              subject: `Physician appointment slot confirmed - ${appointment.requested_date}`,
              text,
              html: text.replace(/\\n/g, '<br/>'),
            }),
          ),
        );

        return new Response(
          `<html><body style="font-family:Arial,sans-serif;"><h3>Slot confirmed</h3><p>You selected ${selectedSlot} on ${appointment.requested_date}.</p></body></html>`,
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'text/html' } },
        );
      } catch (error) {
        return new Response(`Error: ${(error as Error).message}`, { status: 400, headers: corsHeaders });
      }
    }

    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ success: false, error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!supabaseUrl || !serviceRoleKey) throw new Error('Supabase environment variables are not configured');
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Authorization required');
    const token = authHeader.replace('Bearer ', '');

    const { data: authUser, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authUser?.user) throw new Error('Invalid or missing session');

    const profileRes = await supabase.from('profiles').select('id, role, email, first_name, last_name, phone').eq('id', authUser.user.id).single();
    const profile = profileRes.data;
    const role = profile?.role ?? 'user';

    const body = (await req.json()) as RequestPayload;
    const action = body.action;

    if (!action) throw new Error('Missing action');

    if (action === 'request') {
      const { requestedDate, sessionType, sessionDetails } = body;
      if (!requestedDate || !sessionType) throw new Error('Missing requestedDate or sessionType');

      const { data, error } = await supabase
        .from('physician_appointments')
        .insert({
          user_id: profile?.id ?? authUser.user.id,
          coach_id: null,
          requested_date: requestedDate,
          session_type: sessionType,
          session_details: sessionDetails ?? null,
          status: 'pending',
        })
        .select('*')
        .single();
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, appointment: data }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'propose_slots') {
      if (role !== 'coach' && role !== 'admin') throw new Error('Coach or admin access required');
      const { appointmentId, slots } = body;
      if (!appointmentId || !Array.isArray(slots) || slots.length === 0) {
        throw new Error('Appointment id and slots are required');
      }

      const { data: existing, error: existingError } = await supabase
        .from('physician_appointments')
        .select('*, user:profiles!physician_appointments_user_id_fkey(*), coach:profiles!physician_appointments_coach_id_fkey(*)')
        .eq('id', appointmentId)
        .single();
      if (existingError || !existing) throw existingError ?? new Error('Appointment not found');

      const slotsChanged = haveDifferentSlots(existing.proposed_slots, slots);
      const timestamp = new Date().toISOString();

      const { data: appointment, error } = await supabase
        .from('physician_appointments')
        .update({
          status: 'slots_proposed',
          proposed_slots: slots,
          coach_id: profile?.id ?? authUser.user.id,
          decided_at: timestamp,
          partner_email_sent_at: slotsChanged ? timestamp : existing.partner_email_sent_at,
        })
        .eq('id', appointmentId)
        .select('*, user:profiles!physician_appointments_user_id_fkey(*), coach:profiles!physician_appointments_coach_id_fkey(*)')
        .single();
      if (error) throw error;

      if (slotsChanged) {
        await sendPartnerAppointmentEmail(appointment, slots);
      }

      return new Response(JSON.stringify({ success: true, appointment, emailSent: slotsChanged }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'select_slot') {
      const { appointmentId, selectedSlot } = body;
      if (!appointmentId || !selectedSlot) throw new Error('Appointment id and selectedSlot are required');

      const { data: appointment, error } = await supabase
        .from('physician_appointments')
        .update({
          status: 'slot_selected',
          selected_slot: selectedSlot,
          approved_at: new Date().toISOString(),
        })
        .eq('id', appointmentId)
        .select('*, coach:profiles!physician_appointments_coach_id_fkey(*), user:profiles!physician_appointments_user_id_fkey(*)')
        .single();
      if (error) throw error;

      // Create a calendar workout entry (title required).
      await supabase.from('workouts').insert({
        title: 'Physician Appointment',
        user_id: appointment.user_id,
        scheduled_date: appointment.requested_date,
        description: `Physician slot ${selectedSlot} • be on time`,
      });

      if (appointment.coach_id) {
        const athleteName = `${appointment.user?.first_name ?? ''} ${appointment.user?.last_name ?? ''}`.trim() || 'Athlete';
        const payload = {
          id: appointment.id,
          status: 'slot_selected',
          requestedDate: appointment.requested_date,
          dateLabel: formatDateLabel(appointment.requested_date),
          sessionType: appointment.session_type,
          sessionDetails: appointment.session_details,
          selectedSlot,
          athlete: {
            id: appointment.user_id,
            name: athleteName,
            email: appointment.user?.email,
            phone: appointment.user?.phone,
            program: appointment.user?.program_title,
          },
          createdAt: new Date().toISOString(),
          decidedAt: new Date().toISOString(),
        };
        await supabase.from('coach_messages').insert({
          sender_id: appointment.user_id,
          receiver_id: appointment.coach_id,
          sender_role: 'athlete',
          message: `${PHYSICIAN_RESPONSE_PREFIX} ${JSON.stringify(payload)}`,
        });
      }

      const text = `Athlete selected a slot.\n\nDate: ${appointment.requested_date}\nSlot: ${selectedSlot}\nSession type: ${appointment.session_type}\nAthlete: ${appointment.user?.first_name ?? ''} ${appointment.user?.last_name ?? ''}\nEmail: ${appointment.user?.email ?? 'N/A'}\nPhone: ${appointment.user?.phone ?? 'N/A'}`;
      const recipients = [
        appointment.user?.email,
        appointment.coach?.email,
        'onsouenniche6@gmail.com',
      ].filter((v): v is string => Boolean(v));

      await Promise.all(
        recipients.map((to) =>
          sendEmail({
            to,
            subject: `Physician appointment slot selected - ${appointment.requested_date}`,
            text,
            html: text.replace(/\n/g, '<br/>'),
          }),
        ),
      );

      return new Response(JSON.stringify({ success: true, appointment }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'deny') {
      if (role !== 'coach' && role !== 'admin') throw new Error('Coach or admin access required');
      const { appointmentId } = body;
      if (!appointmentId) throw new Error('Appointment id required');

      const { data: appointment, error } = await supabase
        .from('physician_appointments')
        .update({ status: 'denied', decided_at: new Date().toISOString() })
        .eq('id', appointmentId)
        .select('*, user:profiles!physician_appointments_user_id_fkey(*)')
        .single();
      if (error) throw error;

      return new Response(JSON.stringify({ success: true, appointment }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    throw new Error('Unsupported action');
  } catch (error) {
    console.error('physician-appointments error:', error);
    return new Response(JSON.stringify({ success: false, error: (error as Error).message }), {
      status: 400,
      headers: { ...buildCorsHeaders(req, { methods: ['POST', 'OPTIONS'] }), 'Content-Type': 'application/json' },
    });
  }
});
