const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
  });
}

const NEXUS_ORIGIN = 'https://nexus.primetitec.com.br';

module.exports = async (req, res) => {
  const origin = req.headers.origin || '';
  const allowed = ['https://nexus.primetitec.com.br', 'https://rede-social-acf40.web.app', 'https://rede-social-acf40.firebaseapp.com'];
  res.setHeader('Access-Control-Allow-Origin', allowed.includes(origin) ? origin : NEXUS_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const idToken = (req.headers.authorization || '').replace('Bearer ', '');
  if (!idToken) return res.status(401).json({ error: 'Unauthorized' });

  try {
    await admin.auth().verifyIdToken(idToken);
  } catch(e) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  const { toUid, title, body, url, tag } = req.body || {};
  if (!toUid || !title) return res.status(400).json({ error: 'toUid and title required' });

  const userDoc = await admin.firestore().collection('users').doc(toUid).get();
  const fcmToken = userDoc.data()?.fcmToken;
  if (!fcmToken) return res.json({ sent: false, reason: 'no_token' });

  try {
    await admin.messaging().send({
      token: fcmToken,
      notification: { title, body: body || '' },
      webpush: {
        fcmOptions: { link: url || NEXUS_ORIGIN },
        notification: {
          tag: tag || 'nexus-notif',
          renotify: true,
          icon:  `${NEXUS_ORIGIN}/icons/icon-192.png`,
          badge: `${NEXUS_ORIGIN}/icons/icon-72.png`
        }
      }
    });
    res.json({ sent: true });
  } catch(e) {
    if (e.code === 'messaging/registration-token-not-registered') {
      await admin.firestore().collection('users').doc(toUid).update({ fcmToken: null });
      return res.json({ sent: false, reason: 'token_expired' });
    }
    console.error('FCM notify:', e.message);
    res.status(500).json({ error: e.message });
  }
};
