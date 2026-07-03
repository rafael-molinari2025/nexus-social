const Anthropic = require('@anthropic-ai/sdk');
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
  try {
    await admin.auth().verifyIdToken(idToken);
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  const rawText = req.body && typeof req.body.text === 'string' ? req.body.text : '';
  const text = rawText;

  // Sem texto = aprovado
  if (!text.trim()) {
    return res.status(200).json({ decision: 'allow', reason: '', categories: [] });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('ANTHROPIC_API_KEY não configurada');
    return res.status(200).json({ decision: 'allow', reason: 'moderation_unavailable', categories: [] });
  }

  try {
    const client = new Anthropic({ apiKey });

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: `Você é um moderador de conteúdo de uma rede social brasileira chamada Nexus. Analise o texto e decida se viola a Política de Uso da plataforma.

CATEGORIAS DE VIOLAÇÃO (use os identificadores exatos):
- racismo: conteúdo racista, xenófobo ou que discrimina por raça/etnia/origem. NÃO inclui: debater desigualdade racial, relatar discriminação sofrida, crítica antirracista.
- homofobia: conteúdo homofóbico, transfóbico ou que discrimina por orientação sexual/identidade de gênero. NÃO inclui: debater políticas LGBTQIA+, perspectivas religiosas respeitosas.
- odio: discurso de ódio que desumaniza grupos, glorifica genocídios ou incita violência contra grupos. NÃO inclui: criticar ideologias, analisar eventos históricos violentos.
- assedio: ameaças diretas a pessoas identificáveis, doxing, bullying coordenado. NÃO inclui: criticar figura pública, relatar assédio sofrido.
- sexual_explicito: pornografia, descrição gráfica de atos sexuais, qualquer conteúdo sexual envolvendo menores. NÃO inclui: educação sexual, nu artístico, literatura erótica não explícita.
- politico: chamados a golpe de estado, ameaças a instituições democráticas, propaganda terrorista, incitação à violência eleitoral. NÃO inclui: opiniões políticas, crítica a governos/partidos, convocação de manifestações pacíficas.
- desinformacao: informações falsas perigosas sobre saúde (curas milagrosas, anti-vacinas) ou segurança pública (pânicos fabricados), instruções de automutilação. NÃO inclui: questionar estudos com base em evidências, relatos pessoais identificados como tal.
- spam: esquemas de pirâmide, phishing, golpes financeiros, personificação de marcas para enganar. NÃO inclui: divulgação honesta de produtos próprios, promoções legítimas.

TEXTO A ANALISAR:
"""
${text.slice(0, 2000)}
"""

Responda APENAS com JSON válido, sem texto adicional:
{"decision":"allow","reason":"","categories":[]}

REGRAS DE DECISÃO:
- "block": violação clara e inequívoca de uma categoria acima — remover antes de publicar
- "flag": suspeito ou ambíguo — publicar mas enviar para revisão humana
- "allow": conteúdo normal e aceitável — publicar sem restrição

IMPORTANTE: seja conservador. Palavrões leves, opiniões fortes, debates acalorados, críticas duras e humor pesado são "allow" salvo violação direta de uma categoria. Só use "block" quando não houver dúvida razoável.`
      }]
    });

    const raw = response.content[0].text.trim();
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('Resposta inválida da IA');

    const result = JSON.parse(match[0]);
    if (!['allow', 'flag', 'block'].includes(result.decision)) result.decision = 'allow';

    return res.status(200).json({
      decision: result.decision,
      reason:   String(result.reason   || ''),
      categories: Array.isArray(result.categories) ? result.categories : []
    });

  } catch (e) {
    console.error('Erro na moderação:', e.message);
    // Fail-open: se a IA falhar, não bloquear o usuário
    return res.status(200).json({ decision: 'allow', reason: 'error', categories: [] });
  }
};
