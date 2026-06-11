import express from 'express';
import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 3000;
const HTTPS_PORT = 3443;

// Serve the built production files
app.use(express.static(path.join(__dirname, 'dist')));

// TTS proxy - fetches Hebrew audio from Google Translate for the tablet
app.get('/api/tts', (req, res) => {
  const text = req.query.text as string;
  if (!text) { res.status(400).send('Missing text'); return; }
  
  const encoded = encodeURIComponent(text);
  const url = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=he&q=${encoded}`;
  
  https.get(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  }, (upstream) => {
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    upstream.pipe(res);
  }).on('error', () => {
    res.status(500).send('TTS error');
  });
});

// SPA fallback - serve index.html for all routes
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// HTTP server
http.createServer(app).listen(PORT, '0.0.0.0', () => {
  console.log(`\n📋 אפליקציית משימות הבית פועלת!`);
  console.log(`   HTTP:   http://localhost:${PORT}`);
});

// HTTPS server (needed for camera on Android)
const pfxPath = path.join(__dirname, 'certs', 'server.pfx');
if (fs.existsSync(pfxPath)) {
  const httpsOptions = {
    pfx: fs.readFileSync(pfxPath),
    passphrase: 'hallel123',
  };
  https.createServer(httpsOptions, app).listen(HTTPS_PORT, '0.0.0.0', () => {
    console.log(`   HTTPS:  https://localhost:${HTTPS_PORT}`);
    console.log(`   טאבלט:  https://10.100.102.12:${HTTPS_PORT}\n`);
  });
} else {
  console.log(`   ⚠️ אין תעודת SSL - מצלמה לא תעבוד בטאבלט`);
  console.log(`   טאבלט:  http://10.100.102.12:${PORT}\n`);
}
