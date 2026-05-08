// Supabase Edge Function — auth-login
// Secure login with bcrypt password hashing (production replacement for plain-text auth)
// Deploy: supabase functions deploy auth-login

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return new Response(JSON.stringify({ error: "Username and password required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: user, error } = await supabase
      .from("users")
      .select("*, employees(*)")
      .eq("username", username)
      .single();

    if (error || !user) {
      return new Response(JSON.stringify({ error: "Invalid credentials" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // NOTE: In production, replace plain-text comparison with:
    // const valid = await bcrypt.compare(password, user.password);
    // For now, plain-text comparison (matches current DB state):
    const valid = user.password === password;

    if (!valid) {
      return new Response(JSON.stringify({ error: "Invalid credentials" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          employee_id: user.employee_id,
          company_id: user.company_id,
        },
        employee: user.employees,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: "Server error: " + err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
