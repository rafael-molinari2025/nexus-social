/**
 * api/scan.js — Varredura automática de posts sem moderação
 *
 * Configuração no Vercel:
 *   - Variável ANTHROPIC_API_KEY
 *   - Variável FIREBASE_SERVICE_ACCOUNT (JSON string da conta de serviço)
 *   - Variável SCAN_SECRET (string aleatória para trigger manual)
 *
 * Cron configurado em vercel.json para rodar a cada 6 horas.
 * Plano Hobby: executa 1x/dia. Plano Pro: executa conforme cron.
 */

const Anthropic = require('@anthropic-ai/sdk');

let _admin = null;
let _db    = null;

function getDb() {
  if (_db) return _db;
  _admin = require('firebase-admin');
  if (!_admin.apps.length) {
    const svcRaw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!svcRaw) throw new Error('FIREBASE_SERVICE_ACCOUNT não configurada');
    _admin.initializeApp({ credential: _admin.credential.cert(JSON.parse(svcRaw)) });
  }
  _db = _admin.firestore();
  return _db;
}

const PROMPT_TEMPLATE = (text) =>
  `Moderação de conteúdo de rede social brasileira. Analise e classifique.

TEXTO: """${text.slice(0, 1500)}"""

Categorias: racismo, homofobia, politico, odio, assedio, sexual_explicito, desinformacao, spam

Responda APENAS com JSON: {"decision":"allow","reason":"","categories":[]}
Valores: "block" (viola claramente), "flag" (suspeito), "allow" (aceitável)`;

module.exports = async function handler(req, res) {
  // Autenticação: Vercel Cron envia GET com header x-vercel-cron:1
  // Trigger manual: POST com header x-scan-secret ou query ?secret=
  const secret = req.headers['x-scan-secret'] || req.query.secret;
  const isVercelCron = req.method === 'GET' && req.headers['x-vercel-cron'] === '1';
  const isManual = req.method === 'POST' && !!process.env.SCAN_SECRET && secret === process.env.SCAN_SECRET;

  if (!isVercelCron && !isManual) {
    return res.status(401).json({ error: 'Não autorizado' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY ausente' });

  let db;
  try {
    db = getDb();
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }

  try {
    const client = new Anthropic({ apiKey });
    const admin  = _admin;

    // Buscar posts das últimas 48h sem modStatus (ou pendentes)
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const snap   = await db.collection('posts')
      .where('createdAt', '>=', cutoff)
      .orderBy('createdAt', 'desc')
      .limit(60)
      .get();

    const unmoderated = snap.docs.filter(d => {
      const s = d.data().modStatus;
      return !s || s === 'pending';
    });

    if (!unmoderated.length) {
      return res.status(200).json({ scanned: 0, blocked: 0, flagged: 0, approved: 0 });
    }

    let blocked = 0, flagged = 0, approved = 0, errors = 0;

    for (const doc of unmoderated) {
      const text = (doc.data().text || '').trim();

      // Posts sem texto (só imagem/vídeo) são aprovados automaticamente
      if (!text) {
        await doc.ref.update({
          modStatus: 'approved',
          modAt:     admin.firestore.FieldValue.serverTimestamp(),
          modSource: 'scan'
        });
        approved++;
        continue;
      }

      try {
        const response = await client.messages.create({
          model:      'claude-haiku-4-5-20251001',
          max_tokens: 256,
          messages: [{ role: 'user', content: PROMPT_TEMPLATE(text) }]
        });

        const raw   = response.content[0].text.trim();
        const match = raw.match(/\{[\s\S]*\}/);
        const result = match ? JSON.parse(match[0]) : { decision: 'allow', reason: '', categories: [] };
        const decision = ['allow', 'flag', 'block'].includes(result.decision) ? result.decision : 'allow';

        const modStatus = decision === 'block' ? 'removed'
                        : decision === 'flag'  ? 'flagged'
                        : 'approved';

        await doc.ref.update({
          modStatus,
          modReason:     result.reason     || '',
          modCategories: result.categories || [],
          modAt:         admin.firestore.FieldValue.serverTimestamp(),
          modSource:     'scan'
        });

        if (decision === 'block') blocked++;
        else if (decision === 'flag') flagged++;
        else approved++;

      } catch (e) {
        console.error('Erro ao moderar post', doc.id, e.message);
        errors++;
      }
    }

    console.log(`Scan concluído: ${unmoderated.length} posts | ${approved} aprovados | ${flagged} sinalizados | ${blocked} removidos | ${errors} erros`);

    return res.status(200).json({
      scanned:  unmoderated.length,
      blocked,
      flagged,
      approved,
      errors
    });

  } catch (e) {
    console.error('Scan error:', e);
    return res.status(500).json({ error: e.message });
  }
};
