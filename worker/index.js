const REGIONS = {
  eu: 'https://openapi.tuyaeu.com',
  us: 'https://openapi.tuyaus.com',
  cn: 'https://openapi.tuyacn.com',
  in: 'https://openapi.tuyain.com',
};
const SWITCH_CODES = new Set(['switch', 'switch_1', 'switch_led']);
let cachedToken;

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    const corsHeaders = getCorsHeaders(origin, env.ALLOWED_ORIGIN);
    if (request.method === 'OPTIONS') {
      if (!isAllowedOrigin(origin, env.ALLOWED_ORIGIN)) return json({ success: false, error: 'Origin niet toegestaan.' }, 403, corsHeaders);
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    try {
      if (origin && !isAllowedOrigin(origin, env.ALLOWED_ORIGIN)) return json({ success: false, error: 'Origin niet toegestaan.' }, 403, corsHeaders);
      if (!env.DASHBOARD_TOKEN || request.headers.get('Authorization') !== `Bearer ${env.DASHBOARD_TOKEN}`) {
        return json({ success: false, error: 'Ongeldig dashboard-token.' }, 401, corsHeaders);
      }

      const url = new URL(request.url);
      const path = url.searchParams.get('path') || url.pathname;
      if (request.method === 'GET' && path === '/api/devices') {
        const result = await tuyaRequest(env, 'GET', `/v1.0/users/${encodeURIComponent(env.TUYA_UID)}/devices`);
        const devices = Array.isArray(result) ? result.map(toDashboardDevice) : [];
        return json({ success: true, devices }, 200, corsHeaders);
      }

      const commandMatch = path.match(/^\/api\/devices\/([^/]+)\/commands$/);
      if (request.method === 'POST' && commandMatch) {
        const deviceId = decodeURIComponent(commandMatch[1]);
        const command = await request.json();
        if (!SWITCH_CODES.has(command.code) || typeof command.value !== 'boolean') {
          return json({ success: false, error: 'Ongeldig commando.' }, 400, corsHeaders);
        }
        const result = await tuyaRequest(env, 'POST', `/v1.0/iot-03/devices/${encodeURIComponent(deviceId)}/commands`, {
          commands: [{ code: command.code, value: command.value }],
        });
        return json({ success: true, result }, 200, corsHeaders);
      }

      return json({ success: false, error: 'Endpoint niet gevonden.' }, 404, corsHeaders);
    } catch (error) {
      return json({ success: false, error: error.message || 'Tuya-aanvraag mislukt.' }, error.status || 502, corsHeaders);
    }
  },
};

function getCorsHeaders(origin, allowedOrigin) {
  const headers = new Headers({
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Vary': 'Origin',
  });
  if (origin && isAllowedOrigin(origin, allowedOrigin)) headers.set('Access-Control-Allow-Origin', origin);
  return headers;
}

function isAllowedOrigin(origin, allowedOrigin) {
  return !origin || (Boolean(allowedOrigin) && origin === allowedOrigin);
}

function json(body, status, headers) {
  const responseHeaders = new Headers(headers);
  responseHeaders.set('Content-Type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(body), { status, headers: responseHeaders });
}

function toDashboardDevice(device) {
  const status = Array.isArray(device.status) ? device.status : [];
  const switchCode = status.find((item) => SWITCH_CODES.has(item.code))?.code || null;
  const deviceInfo = `${device.category || ''} ${device.name || ''}`;
  const category = /light|lamp|dj/i.test(deviceInfo)
    ? 'light'
    : /sensor|temp|humidity/i.test(deviceInfo)
      ? 'sensor'
      : 'plug';
  return {
    id: device.id,
    name: device.name || 'Tuya-apparaat',
    room: device.room_name || device.area_name || (category === 'light' ? 'Lamp' : category === 'sensor' ? 'Sensor' : 'Stekker'),
    category,
    online: Boolean(device.online),
    on: Boolean(status.find((item) => item.code === switchCode)?.value),
    switchCode,
  };
}

async function tuyaRequest(env, method, path, body) {
  if (!env.TUYA_UID || !env.TUYA_ACCESS_ID || !env.TUYA_ACCESS_SECRET) {
    const error = new Error('Tuya Worker-configuratie ontbreekt. Controleer de Cloudflare-instellingen.');
    error.status = 500;
    throw error;
  }
  const origin = REGIONS[(env.TUYA_REGION || 'eu').toLowerCase()];
  if (!origin) {
    const error = new Error('Onbekende Tuya-regio. Gebruik eu, us, cn of in.');
    error.status = 500;
    throw error;
  }
  const accessToken = await getAccessToken(env, origin);
  const response = await signedTuyaFetch(env, origin, method, path, body, accessToken);
  if (!response.success) {
    const error = new Error(response.msg || 'Tuya API heeft de aanvraag geweigerd.');
    error.status = 502;
    throw error;
  }
  return response.result;
}

async function getAccessToken(env, origin) {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000 && cachedToken.accessId === env.TUYA_ACCESS_ID) {
    return cachedToken.value;
  }
  const response = await signedTuyaFetch(env, origin, 'GET', '/v1.0/token?grant_type=1');
  if (!response.success || !response.result?.access_token) {
    const error = new Error(response.msg || 'Tuya-token ophalen mislukt.');
    error.status = 502;
    throw error;
  }
  cachedToken = {
    value: response.result.access_token,
    accessId: env.TUYA_ACCESS_ID,
    expiresAt: Date.now() + Number(response.result.expire_time || response.result.expires_in || 3600) * 1000,
  };
  return cachedToken.value;
}

async function signedTuyaFetch(env, origin, method, path, body, accessToken = '') {
  const timestamp = Date.now().toString();
  const bodyText = body === undefined ? '' : JSON.stringify(body);
  const contentHash = await sha256(bodyText);
  const stringToSign = `${method}\n${contentHash}\n\n${path}`;
  const sign = await hmacSha256(env.TUYA_ACCESS_SECRET, `${env.TUYA_ACCESS_ID}${accessToken}${timestamp}${stringToSign}`);
  const headers = {
    client_id: env.TUYA_ACCESS_ID,
    t: timestamp,
    sign_method: 'HMAC-SHA256',
    sign,
  };
  if (accessToken) headers.access_token = accessToken;
  if (bodyText) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${origin}${path}`, { method, headers, body: bodyText || undefined });
  return response.json();
}

async function sha256(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return toHex(digest);
}

async function hmacSha256(secret, value) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return toHex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value))).toUpperCase();
}

function toHex(buffer) {
  return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, '0')).join('');
}