const crypto = require('crypto');
const admin  = require('firebase-admin');

if (!admin.apps.length) {
  try {
    admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}')) });
  } catch (e) { console.error('Admin init:', e.message); }
}

module.exports = async function handler(req, res) {
  const origin   = req.headers.origin || '';
  const _allowed = ['https://nexus.primetitec.com.br', 'https://rede-social-acf40.web.app', 'https://rede-social-acf40.firebaseapp.com'];
  res.setHeader('Access-Control-Allow-Origin', _allowed.includes(origin) ? origin : 'https://nexus.primetitec.com.br');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const idToken = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (!idToken) return res.status(401).json({ error: 'Unauthorized' });
  try {
    await admin.auth().verifyIdToken(idToken);
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  const apiKey    = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  const cloudName = 'dyoi5mrdc';

  if (!apiKey || !apiSecret) {
    return res.status(500).json({ error: 'Cloudinary credentials not configured' });
  }

  // Assinatura apenas com timestamp — sem public_id para evitar discrepâncias
  const timestamp = Math.round(Date.now() / 1000);
  const toSign    = `timestamp=${timestamp}` + apiSecret;
  const signature = crypto.createHash('sha1').update(toSign).digest('hex');

  res.status(200).json({ signature, timestamp, api_key: apiKey, cloud_name: cloudName });
};
