const admin = require('firebase-admin');

if (!admin.apps.length) {
  try {
    admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}')) });
  } catch (e) { console.error('Admin init:', e.message); }
}

module.exports = async function handler(req, res) {
  const origin = req.headers.origin || '';
  const _allowed = ['https://nexus.primetitec.com.br', 'https://rede-social-acf40.web.app', 'https://rede-social-acf40.firebaseapp.com'];
  res.setHeader('Access-Control-Allow-Origin', _allowed.includes(origin) ? origin : 'https://nexus.primetitec.com.br');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const idToken = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (!idToken) return res.status(401).json({ error: 'Unauthorized' });

  let callerUid;
  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    callerUid = decoded.uid;
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  const db = admin.firestore();
  const callerSnap = await db.collection('users').doc(callerUid).get();
  if (!callerSnap.exists || !callerSnap.data().isAdmin) {
    return res.status(403).json({ error: 'Forbidden: admin only' });
  }

  const { action, uid } = req.body || {};
  if (!action || !uid) return res.status(400).json({ error: 'Missing action or uid' });
  if (uid === callerUid) return res.status(400).json({ error: 'Cannot moderate your own account' });

  try {
    if (action === 'delete') {
      // Desabilitar Auth e excluir doc Firestore
      await admin.auth().deleteUser(uid);
      await db.collection('users').doc(uid).delete();
      return res.status(200).json({ ok: true });
    }

    if (action === 'disable_auth') {
      // Apenas desabilita o login (usado em conjunto com ban no Firestore)
      await admin.auth().updateUser(uid, { disabled: true });
      return res.status(200).json({ ok: true });
    }

    if (action === 'enable_auth') {
      // Reabilita o login (usado ao restaurar conta)
      await admin.auth().updateUser(uid, { disabled: false });
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: 'Invalid action' });
  } catch (e) {
    console.error('manage-user error:', action, uid, e.message);
    return res.status(500).json({ error: e.message });
  }
};
