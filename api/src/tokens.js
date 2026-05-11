const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function base64UrlEncode(input) {
  const bytes = typeof input === 'string' ? textEncoder.encode(input) : input;
  let binary = '';

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlDecode(base64Value) {
  const base64 = base64Value.replace(/-/g, '+').replace(/_/g, '/');
  const paddingLength = (4 - (base64.length % 4 || 4)) % 4;
  const padded = `${base64}${'='.repeat(paddingLength)}`;
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return bytes;
}

async function importHmacKey(secret) {
  return crypto.subtle.importKey(
    'raw',
    textEncoder.encode(secret),
    {
      name: 'HMAC',
      hash: 'SHA-256',
    },
    false,
    ['sign', 'verify'],
  );
}

export async function sha256Base64Url(value) {
  const digest = await crypto.subtle.digest('SHA-256', textEncoder.encode(value));
  return base64UrlEncode(new Uint8Array(digest));
}

export async function createSignedRunToken(payload, secret) {
  const key = await importHmacKey(secret);
  const payloadPart = base64UrlEncode(JSON.stringify(payload));
  const signature = await crypto.subtle.sign('HMAC', key, textEncoder.encode(payloadPart));
  const signaturePart = base64UrlEncode(new Uint8Array(signature));
  return `${payloadPart}.${signaturePart}`;
}

export async function verifySignedRunToken(token, secret) {
  if (!token || !token.includes('.')) {
    return null;
  }

  const [payloadPart, signaturePart] = token.split('.');
  const key = await importHmacKey(secret);
  const isValid = await crypto.subtle.verify(
    'HMAC',
    key,
    base64UrlDecode(signaturePart),
    textEncoder.encode(payloadPart),
  );

  if (!isValid) {
    return null;
  }

  const payloadJson = textDecoder.decode(base64UrlDecode(payloadPart));
  return JSON.parse(payloadJson);
}