import https from 'https';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  const text = req.query.text as string;
  if (!text) {
    res.status(400).send('Missing text');
    return;
  }

  const encoded = encodeURIComponent(text);
  const url = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=he&q=${encoded}`;

  https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (upstream) => {
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    upstream.pipe(res);
  }).on('error', () => {
    res.status(500).send('TTS error');
  });
}
