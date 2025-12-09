// supabase/functions/send-push/index.ts
// WORKING VERSION - Uses web-push library

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }), 
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  console.log("📬 ===== PUSH NOTIFICATION REQUEST =====");

  try {
    const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    console.log("🔑 Environment check:");
    console.log("- VAPID_PUBLIC_KEY:", vapidPublic ? "✅ Set" : "❌ Missing");
    console.log("- VAPID_PRIVATE_KEY:", vapidPrivate ? "✅ Set" : "❌ Missing");

    if (!vapidPublic || !vapidPrivate) {
      return new Response(
        JSON.stringify({ error: "VAPID keys not configured" }), 
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ✅ Configure web-push with VAPID keys
    webpush.setVapidDetails(
      "mailto:admin@spcalerts.com",
      vapidPublic,
      vapidPrivate
    );

    const requestData = await req.json();
    const { 
      title, 
      body, 
      icon = "/public/img/icon-192.png",
      badge = "/public/img/badge-72.png",
      image, 
      url = "/public/html/index.html",
      data
    } = requestData;

    console.log(`📨 Notification: "${title}" - "${body}"`);

    if (!title || !body) {
      return new Response(
        JSON.stringify({ error: "title and body are required" }), 
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl!, supabaseKey!);
    
    const { data: subscriptions, error: fetchError } = await supabase
      .from("push_subscriptions")
      .select("id, user_id, subscription");

    if (fetchError) {
      console.error("❌ Database error:", fetchError);
      return new Response(
        JSON.stringify({ error: `Database error: ${fetchError.message}` }), 
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`📊 Found ${subscriptions?.length || 0} subscription(s)`);

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ success: true, delivered_to: 0, message: "No subscribers" }), 
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const notificationPayload = JSON.stringify({ 
      title, 
      body, 
      icon: icon || "/public/img/icon-192.png",
      badge: badge || "/public/img/badge-72.png",
      image, 
      url,
      data: data || {} // Include custom data for notification
    });

    let delivered = 0;
    let failed = 0;
    const errors: Array<{id: string, error: string}> = [];

    for (const { id, subscription } of subscriptions) {
      try {
        console.log(`\n📤 Sending to subscription ${id}...`);
        
        const sub = typeof subscription === 'string' ? JSON.parse(subscription) : subscription;
        console.log(`- Endpoint: ${sub.endpoint.substring(0, 50)}...`);
        
        // ✅ Use web-push library to send
        const result = await webpush.sendNotification(
          sub,
          notificationPayload,
          {
            TTL: 86400,
            contentEncoding: "aes128gcm"
          }
        );

        console.log(`✅ Delivered successfully (status: ${result.statusCode})`);
        delivered++;

      } catch (error) {
        console.error(`❌ Failed:`, error.message);
        failed++;
        errors.push({ id, error: error.message });

        // Remove invalid subscriptions
        if (error.statusCode === 410 || error.statusCode === 404) {
          console.log(`🗑️ Removing invalid subscription ${id}`);
          await supabase.from("push_subscriptions").delete().eq("id", id);
        }
      }
    }

    console.log(`\n📊 FINAL RESULTS:`);
    console.log(`- Delivered: ${delivered}`);
    console.log(`- Failed: ${failed}`);

    return new Response(
      JSON.stringify({ 
        success: true,
        delivered_to: delivered,
        failed: failed,
        total_subscriptions: subscriptions.length,
        errors: errors
      }), 
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("❌ FATAL ERROR:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        type: error.name,
        stack: error.stack
      }), 
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
