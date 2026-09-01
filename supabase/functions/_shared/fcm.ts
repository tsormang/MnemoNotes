import { create, getNumericDate } from 'https://deno.land/x/djwt@v3.0.2/mod.ts'

interface ServiceAccount {
  project_id: string
  client_email: string
  private_key: string
}

interface FcmPayload {
  title: string
  body: string
  data: Record<string, string>
}

function parseServiceAccount(raw: string): ServiceAccount {
  const parsed = JSON.parse(raw) as ServiceAccount
  if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
    throw new Error('FCM_SERVICE_ACCOUNT is missing required fields.')
  }
  return parsed
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const normalized = pem.replace(/\\n/g, '\n')
  const contents = normalized
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s+/g, '')
  const binary = Uint8Array.from(atob(contents), (char) => char.charCodeAt(0))

  return crypto.subtle.importKey(
    'pkcs8',
    binary,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )
}

async function getAccessToken(serviceAccount: ServiceAccount): Promise<string> {
  const key = await importPrivateKey(serviceAccount.private_key)
  const jwt = await create(
    { alg: 'RS256', typ: 'JWT' },
    {
      iss: serviceAccount.client_email,
      sub: serviceAccount.client_email,
      aud: 'https://oauth2.googleapis.com/token',
      iat: getNumericDate(0),
      exp: getNumericDate(3600),
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
    },
    key,
  )

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`Failed to obtain FCM access token: ${detail}`)
  }

  const payload = (await response.json()) as { access_token?: string }
  if (!payload.access_token) {
    throw new Error('FCM access token response did not include access_token.')
  }

  return payload.access_token
}

export async function sendFcmMessage(token: string, payload: FcmPayload): Promise<void> {
  const raw = Deno.env.get('FCM_SERVICE_ACCOUNT')
  if (!raw) {
    throw new Error('FCM_SERVICE_ACCOUNT is not configured.')
  }

  const serviceAccount = parseServiceAccount(raw)
  const accessToken = await getAccessToken(serviceAccount)

  const response = await fetch(
    `https://fcm.googleapis.com/v1/projects/${serviceAccount.project_id}/messages:send`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          token,
          notification: {
            title: payload.title,
            body: payload.body,
          },
          data: payload.data,
          android: {
            priority: 'HIGH',
            notification: {
              channel_id: 'reminders',
              click_action: 'OPEN_EVENT',
            },
          },
        },
      }),
    },
  )

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`FCM send failed: ${detail}`)
  }
}
