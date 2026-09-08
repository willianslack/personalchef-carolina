const express = require('express');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const port = process.env.PORT || 3000;

const isLocalDb = !process.env.DATABASE_URL || process.env.DATABASE_URL.includes('localhost');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isLocalDb ? false : { rejectUnauthorized: false },
});

async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS cadastros (
      id SERIAL PRIMARY KEY,
      nome TEXT NOT NULL,
      whatsapp TEXT NOT NULL,
      bairro TEXT,
      interesse TEXT NOT NULL,
      observacoes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

function requireAdmin(req, res, next) {
  const auth = req.headers.authorization || '';
  const [scheme, encoded] = auth.split(' ');
  if (scheme === 'Basic' && encoded) {
    const [user, pass] = Buffer.from(encoded, 'base64').toString('utf8').split(':');
    if (user === (process.env.ADMIN_USER || 'carolina') && pass && pass === process.env.ADMIN_PASSWORD) {
      return next();
    }
  }
  res.set('WWW-Authenticate', 'Basic realm="Carolina Cocina Admin"');
  res.status(401).send('Acesso restrito.');
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/cadastro', async (req, res) => {
  const { nome, whats, bairro, interesse, obs } = req.body || {};
  if (!nome || !whats || !interesse) {
    return res.status(400).json({ error: 'Nome, WhatsApp e interesse são obrigatórios.' });
  }
  try {
    await pool.query(
      `INSERT INTO cadastros (nome, whatsapp, bairro, interesse, observacoes) VALUES ($1, $2, $3, $4, $5)`,
      [String(nome).trim(), String(whats).trim(), String(bairro || '').trim(), String(interesse).trim(), String(obs || '').trim()]
    );
    res.status(201).json({ ok: true });
  } catch (err) {
    console.error('Erro ao salvar cadastro:', err);
    res.status(500).json({ error: 'Não foi possível salvar o cadastro.' });
  }
});

app.get('/api/cadastros', requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, nome, whatsapp, bairro, interesse, observacoes, created_at FROM cadastros ORDER BY created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error('Erro ao listar cadastros:', err);
    res.status(500).json({ error: 'Não foi possível carregar os cadastros.' });
  }
});

app.get('/admin', requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'index.html'));
});

ensureSchema()
  .then(() => {
    app.listen(port, () => console.log(`Carolina Cocina rodando na porta ${port}`));
  })
  .catch((err) => {
    console.error('Erro ao preparar o banco de dados:', err);
    process.exit(1);
  });
