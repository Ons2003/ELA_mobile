import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6.9.11";

type EmailPayload = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

type RequestPayload = {
  to: string;
  subject: string;
  content: string;
  html?: string;
};

const ALLOWED_ORIGINS = [
  "https://elyesliftacademy.com",
  "https://www.elyesliftacademy.com",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

const buildCorsHeaders = (req: Request, options?: { methods?: string[] }) => {
  const methods = options?.methods ?? ["POST", "OPTIONS"];
  const origin = req.headers.get("Origin");
  const isAllowed = origin && ALLOWED_ORIGINS.includes(origin);

  return {
    "Access-Control-Allow-Origin": isAllowed ? origin! : "*",
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
  };
};

const handleOptions = (req: Request, methods?: string[]) =>
  new Response(null, {
    status: 204,
    headers: buildCorsHeaders(req, { methods }),
  });

const buildTransporter = () => {
  const host = Deno.env.get("SMTP_HOST");
  const port = Number(Deno.env.get("SMTP_PORT") ?? 465);
  const user = Deno.env.get("SMTP_USER");
  const pass = Deno.env.get("SMTP_PASS");

  if (!host || !user || !pass) {
    throw new Error("SMTP credentials are not configured");
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass,
    },
  });
};

const sendEmail = async (payload: EmailPayload) => {
  const transporter = buildTransporter();
  const from = Deno.env.get("SMTP_FROM") ?? Deno.env.get("SMTP_USER") ?? "no-reply@elyesliftacademy.com";

  const result = await transporter.sendMail({
    from,
    to: payload.to,
    subject: payload.subject,
    text: payload.text,
    html: payload.html ?? payload.text,
  });

  return result;
};

const allowedMethods = ["POST", "OPTIONS"];

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req, { methods: allowedMethods });

  if (req.method === "OPTIONS") {
    return handleOptions(req, allowedMethods);
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ success: false, error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Supabase environment variables are not configured");
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Authorization required");
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) {
      throw new Error("Invalid or missing user session");
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, email")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "coach" && profile?.role !== "admin") {
      throw new Error("Coach or admin access required");
    }

    const body = (await req.json()) as RequestPayload;
    const to = body.to?.trim();
    const subject = body.subject?.trim();
    const content = body.content?.trim();
    const html = body.html?.trim();

    if (!to || !subject || !content) {
      throw new Error("To, subject, and content are required");
    }

    await sendEmail({
      to,
      subject,
      text: content,
      html: html || content.replace(/\n/g, "<br/>"),
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error sending physician email:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
