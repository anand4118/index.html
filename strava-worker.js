// SUB-4 Logbook — Strava proxy
//
// Why this exists: Strava's /oauth/token endpoint blocks direct browser
// requests (no CORS headers, by design — it's the step that needs your
// secret). This worker does that one step server-side so your Client Secret
// never has to live in the app's HTML/JS or your phone's storage.
//
// Deploy: paste this into a Cloudflare Worker (free), then add two
// environment variables in the Worker's settings:
//   STRAVA_CLIENT_ID      = your numeric Client ID from strava.com/settings/api
//   STRAVA_CLIENT_SECRET  = your Client Secret from the same page
//
// The app only ever needs to know your Client ID (public, fine) and this
// Worker's URL. The secret stays here.

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: cors });
    }

    // POST /token  { grant_type, code? , refresh_token? }
    if (url.pathname === '/token' && request.method === 'POST') {
      let body;
      try { body = await request.json(); } catch { body = {}; }

      const params = new URLSearchParams({
        client_id: env.STRAVA_CLIENT_ID,
        client_secret: env.STRAVA_CLIENT_SECRET,
        grant_type: body.grant_type || 'authorization_code',
      });
      if (body.code) params.set('code', body.code);
      if (body.refresh_token) params.set('refresh_token', body.refresh_token);

      const stravaRes = await fetch('https://www.strava.com/oauth/token', {
        method: 'POST',
        body: params,
      });
      const json = await stravaRes.json();
      return new Response(JSON.stringify(json), {
        status: stravaRes.status,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    // GET /activities?after=<unix_ts>&page=<n>   (Authorization: Bearer <token> required)
    if (url.pathname === '/activities' && request.method === 'GET') {
      const auth = request.headers.get('Authorization') || '';
      const after = url.searchParams.get('after') || '0';
      const page = url.searchParams.get('page') || '1';

      const stravaRes = await fetch(
        `https://www.strava.com/api/v3/athlete/activities?after=${after}&per_page=100&page=${page}`,
        { headers: { Authorization: auth } }
      );
      const json = await stravaRes.json();
      return new Response(JSON.stringify(json), {
        status: stravaRes.status,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    return new Response('Not found', { status: 404, headers: cors });
  },
};
