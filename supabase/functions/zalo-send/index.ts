import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ZaloRequest {
  type: "fee_reminder" | "notification" | "attendance";
  phone: string;
  student_name?: string;
  amount?: number;
  month?: number;
  title?: string;
  content?: string;
  status?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing authorization" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body: ZaloRequest = await req.json();

    const { data: school } = await supabase
      .from("schools")
      .select("zalo_oa_id, zalo_access_token, zalo_template_fee, zalo_template_attendance")
      .limit(1)
      .single();

    if (!school?.zalo_access_token) {
      return new Response(
        JSON.stringify({ success: false, error: "Zalo chưa được cấu hình" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let zaloPayload: Record<string, unknown>;
    let templateId: string | null = null;

    switch (body.type) {
      case "fee_reminder":
        templateId = school.zalo_template_fee;
        zaloPayload = {
          phone: body.phone,
          template_id: templateId,
          template_data: {
            student_name: body.student_name,
            amount: body.amount?.toLocaleString("vi-VN"),
            month: String(body.month),
          },
        };
        break;
      case "attendance":
        templateId = school.zalo_template_attendance;
        zaloPayload = {
          phone: body.phone,
          template_id: templateId,
          template_data: {
            student_name: body.student_name,
            status: body.status,
          },
        };
        break;
      case "notification":
        zaloPayload = {
          phone: body.phone,
          message: { title: body.title, content: body.content },
        };
        break;
      default:
        return new Response(
          JSON.stringify({ success: false, error: "Invalid message type" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
    }

    if (body.type !== "notification" && !templateId) {
      return new Response(
        JSON.stringify({ success: false, error: `Template Zalo cho "${body.type}" chưa được thiết lập` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const zaloEndpoint =
      body.type === "notification"
        ? "https://openapi.zalo.me/v3.0/oa/message/cs"
        : "https://business.openapi.zalo.me/message/template";

    const zaloRes = await fetch(zaloEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        access_token: school.zalo_access_token,
      },
      body: JSON.stringify(zaloPayload),
    });

    const zaloData = await zaloRes.json();

    if (zaloData.error !== 0 && zaloData.error !== undefined) {
      return new Response(
        JSON.stringify({ success: false, error: zaloData.message || "Zalo API error" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ success: true, data: zaloData }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err instanceof Error ? err.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
