import { corsHeaders } from '../_shared/cors.ts';

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/twilio';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) {
    return new Response(JSON.stringify({ error: 'LOVABLE_API_KEY is not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const TWILIO_API_KEY = Deno.env.get('TWILIO_API_KEY');
  if (!TWILIO_API_KEY) {
    return new Response(JSON.stringify({ error: 'TWILIO_API_KEY is not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { to, from } = await req.json();

    if (!to || !from) {
      return new Response(JSON.stringify({ error: 'Missing "to" or "from" phone number' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate E.164 format
    const e164 = /^\+[1-9]\d{1,14}$/;
    if (!e164.test(to) || !e164.test(from)) {
      return new Response(JSON.stringify({ error: 'Phone numbers must be in E.164 format (e.g. +15558675310)' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const response = await fetch(`${GATEWAY_URL}/Calls.json`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'X-Connection-Api-Key': TWILIO_API_KEY,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        To: to,
        From: from,
        Twiml: '<Response><Say>Hello from ChatRoom! This is a test call.</Say></Response>',
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(`Twilio API error [${response.status}]: ${JSON.stringify(data)}`);
    }

    return new Response(JSON.stringify({ success: true, callSid: data.sid }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Error making phone call:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
