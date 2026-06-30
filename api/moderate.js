const Anthropic = require('@anthropic-ai/sdk');

module.exports = async function handler(req, res) {
  const origin = req.headers.origin || '';
  const _allowed = ['https://nexus.primetitec.com.br', 'https://rede-social-acf40.web.app', 'https://rede-social-acf40.firebaseapp.com'];
  res.setHeader('Access-Control-Allow-Origin', _allowed.includes(origin) ? origin : 'https://nexus.primetitec.com.br');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

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
        content: `Você é um moderador de uma rede social brasileira. Analise o texto abaixo e determine se viola alguma política.

POLÍTICAS DE CONTEÚDO PROIBIDO:
- racismo: conteúdo racista, xenófobo, discriminação étnica/racial
- homofobia: conteúdo homofóbico, transfóbico, discriminação por orientação/identidade sexual
- politico: propaganda extremista, incitação a golpe, ameaças a instituições democráticas, discurso político que incita ódio ou violência
- odio: discurso de ódio, desumanização de grupos, incitação à violência
- assedio: assédio, bullying, ameaças diretas a pessoas identificáveis
- sexual_explicito: pornografia ou conteúdo sexual explícito
- desinformacao: notícias falsas perigosas sobre saúde ou segurança pública
- spam: spam comercial enganoso

TEXTO A ANALISAR:
"""
${text.slice(0, 2000)}
"""

Responda APENAS com JSON válido, sem texto adicional:
{"decision":"allow","reason":"","categories":[]}

Regras de decisão:
- "block": claramente viola uma política — não deve ser publicado
- "flag": suspeito ou ambíguo — requer revisão humana
- "allow": conteúdo normal, aceitável na plataforma

Contexto importante: opiniões políticas comuns, críticas construtivas, palavrões leves sem alvo específico e debates acalorados são "allow". Só classifique como "block" ou "flag" se houver violação clara ou forte suspeita.`
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
