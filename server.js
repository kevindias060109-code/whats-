require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const { WA_TOKEN, WA_PHONE_ID, VERIFY_TOKEN, ADMIN_USER, ADMIN_PASS, PORT = 3000 } = process.env;
const DB = path.join(__dirname, 'data.json');
const load = () => (fs.existsSync(DB) ? JSON.parse(fs.readFileSync(DB)) : { lists: [], optout: [] });
const save = (d) => fs.writeFileSync(DB, JSON.stringify(d, null, 2));
const clean = (n) => String(n).replace(/\D/g, ''); // só dígitos, com DDI (ex: 5511999998888)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const app = express();
app.use(express.json());

// --- Webhook (sem senha: a Meta precisa acessar) ---
app.get('/webhook', (req, res) => {
  if (req.query['hub.verify_token'] === VERIFY_TOKEN) return res.send(req.query['hub.challenge']);
  res.sendStatus(403);
});
app.post('/webhook', (req, res) => {
  // Quem responder "SAIR" é removido dos envios (exigência de opt-out)
  const msgs = req.body?.entry?.[0]?.changes?.[0]?.value?.messages || [];
  const db = load();
  for (const m of msgs) {
    if (m.text?.body?.trim().toUpperCase() === 'SAIR' && !db.optout.includes(m.from)) db.optout.push(m.from);
  }
  save(db);
  res.sendStatus(200);
});

// --- Painel protegido por senha ---
app.use((req, res, next) => {
  const [u, p] = Buffer.from((req.headers.authorization || '').split(' ')[1] || '', 'base64').toString().split(':');
  if (u === ADMIN_USER && p === ADMIN_PASS) return next();
  res.set('WWW-Authenticate', 'Basic realm="zap-lista"').sendStatus(401);
});
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/lists', (req, res) => res.json(load()));
app.post('/api/lists', (req, res) => {
  const { name, contacts } = req.body;
  const nums = [...new Set(String(contacts).split(/[\n,;]+/).map(clean).filter((n) => n.length >= 10))];
  if (!name || !nums.length) return res.status(400).json({ error: 'Informe um nome e ao menos um número válido.' });
  const db = load();
  db.lists.push({ id: Date.now().toString(), name, contacts: nums });
  save(db);
  res.json({ ok: true });
});
app.delete('/api/lists/:id', (req, res) => {
  const db = load();
  db.lists = db.lists.filter((l) => l.id !== req.params.id);
  save(db);
  res.json({ ok: true });
});

// Envia um TEMPLATE aprovado para cada contato da lista
app.post('/api/send', async (req, res) => {
  const { listId, template, language = 'pt_BR' } = req.body;
  const db = load();
  const list = db.lists.find((l) => l.id === listId);
  if (!list || !template) return res.status(400).json({ error: 'Escolha uma lista e o nome do template.' });
  const targets = list.contacts.filter((n) => !db.optout.includes(n));
  let sent = 0;
  const failed = [];
  for (const to of targets) {
    const r = await fetch(`https://graph.facebook.com/v21.0/${WA_PHONE_ID}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${WA_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'template', template: { name: template, language: { code: language } } }),
    });
    if (r.ok) sent++;
    else failed.push({ to, erro: (await r.json()).error?.message });
    await sleep(200); // respeita o limite de envio
  }
  res.json({ sent, skipped: list.contacts.length - targets.length, failed });
});

app.listen(PORT, () => console.log(`Rodando em http://localhost:${PORT}`));
