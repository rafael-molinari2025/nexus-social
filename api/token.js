const { RtcTokenBuilder, RtcRole } = require('agora-token');

const APP_ID = '6178ae4b6a854914bc111c753bcd6350';

module.exports = function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const channel = req.query.channel;
  if (!channel) return res.status(400).json({ error: 'channel is required' });

  const cert = process.env.AGORA_CERT;
  if (!cert) return res.status(500).json({ error: 'AGORA_CERT not configured' });

  try {
    const expireAt = Math.floor(Date.now() / 1000) + 7200; // 2 horas
    const token = RtcTokenBuilder.buildTokenWithUid(
      APP_ID, cert, channel, 0, RtcRole.PUBLISHER, expireAt
    );
    res.status(200).json({ token, expireAt });
  } catch (e) {
    res.status(500).json({ error: 'token generation failed' });
  }
};
