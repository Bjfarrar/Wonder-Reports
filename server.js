import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import nodemailer from 'nodemailer';

export function messages(state, id, from) {
  const report = state.reports.find(r => r.id === id);
  if (!report) throw Error('Report not found.');
  const p = state.productions.find(p => p.id === report.production);
  const unique = values => [...new Set(values.map(v => v.trim().toLowerCase()).filter(Boolean))];
  const to = unique(p.managers.split(','));
  const allCast = unique(p.people.filter(x => x.role === 'Cast').map(x => x.email));
  const cast = allCast.filter(x => !to.includes(x));
  const crew = unique(p.people.filter(x => x.role !== 'Cast').map(x => x.email)).filter(x => !allCast.includes(x) && !to.includes(x));
  if (!to.length || !cast.length || !crew.length) throw Error('Add manager, cast, and non-cast email recipients before sending.');
  if ([...to, ...cast, ...crew].some(x => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x))) throw Error('Invalid recipient email address.');
  const common = { from, to, subject: `${report.type.toUpperCase()} REPORT: ${p.name} — ${report.date}`, text: Object.entries(report.fields).filter(([,v]) => v).map(([k,v]) => `${k}:\n${v}`).join('\n\n') + `\n\nSchedule: ${p.schedule || ''}\nProduction folder: ${p.folder || ''}` };
  return [{...common, envelope: {from, to: [...to, ...cast]}}, {...common, cc: crew, envelope: {from, to: [...to, ...crew]}}];
}

export function createApp({dbPath = process.env.REPORTS_DB || new URL('./reports.sqlite3', import.meta.url).pathname, transport} = {}) {
  const db = new DatabaseSync(dbPath);
  db.exec('CREATE TABLE IF NOT EXISTS state (id INTEGER PRIMARY KEY, data TEXT)');
  const state = () => JSON.parse(db.prepare('SELECT data FROM state WHERE id=1').get()?.data || '{"productions":[],"reports":[]}');
  const server = http.createServer(async (req, res) => {
    const reply = (status, value) => { res.writeHead(status, {'Content-Type': 'application/json'}); res.end(JSON.stringify(value)); };
    try {
      if (req.method === 'GET' && req.url === '/api/state') return reply(200, state());
      if (req.method === 'POST') {
        let raw = '';
        for await (const chunk of req) { raw += chunk; if (raw.length > 2_000_000) return reply(413, {error: 'Report data too large.'}); }
        const data = JSON.parse(raw);
        if (req.url === '/api/state') {
          if (!Array.isArray(data.productions) || !Array.isArray(data.reports)) throw Error('Invalid workspace data.');
          db.prepare('INSERT OR REPLACE INTO state VALUES (1, ?)').run(JSON.stringify(data));
          return reply(200, {ok: true});
        }
        if (req.url === '/api/send') {
          if (!transport && (!process.env.SMTP_HOST || !process.env.SMTP_FROM)) throw Error('Email is not configured. Set SMTP_HOST and SMTP_FROM on the server.');
          const copies = messages(state(), data.id, process.env.SMTP_FROM || 'test@example.org');
          const mail = transport || nodemailer.createTransport({host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587), secure: false, requireTLS: true, auth: process.env.SMTP_USER ? {user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD} : undefined});
          const sent = [];
          for (const [index, copy] of copies.entries()) {
            try {
              const result = await mail.sendMail(copy);
              if (result.rejected?.length) throw Error('Recipients rejected');
              sent.push(index === 0 ? 'Cast' : 'Production team');
            } catch { return reply(502, {error: `Delivery interrupted. Accepted copies: ${sent.join(', ') || 'none'}. Check mail logs before retrying.`}); }
          }
          return reply(200, {ok: true, message: 'Both copies accepted by the mail server.'});
        }
      }
      const files = {'/': ['index.html', 'text/html'], '/app.js': ['app.js', 'text/javascript'], '/style.css': ['style.css', 'text/css']};
      if (req.method !== 'GET' || !files[req.url]) return reply(404, {error: 'Not found'});
      const [file, type] = files[req.url];
      const body = await readFile(new URL(`./static/${file}`, import.meta.url));
      res.writeHead(200, {'Content-Type': type}); res.end(body);
    } catch (error) { reply(400, {error: error.message}); }
  });
  server.on('close', () => db.close());
  return server;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  createApp().listen(Number(process.env.PORT || 8000), process.env.HOST || '127.0.0.1', () => console.log(`Wonder Reports listening on port ${process.env.PORT || 8000}`));
}
