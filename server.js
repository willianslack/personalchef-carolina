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
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ingredientes (
      id SERIAL PRIMARY KEY,
      nome TEXT NOT NULL UNIQUE,
      preco_kg NUMERIC(10,2) NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS receitas (
      prato TEXT PRIMARY KEY,
      itens JSONB NOT NULL DEFAULT '[]'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
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
  res.set('WWW-Authenticate', 'Basic realm="Personal Chef Carolina Admin"');
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

app.delete('/api/cadastros/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'Id inválido.' });
  }
  try {
    await pool.query(`DELETE FROM cadastros WHERE id = $1`, [id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('Erro ao excluir cadastro:', err);
    res.status(500).json({ error: 'Não foi possível excluir o cadastro.' });
  }
});

app.get('/api/ingredientes', requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, nome, preco_kg, updated_at FROM ingredientes ORDER BY nome ASC`
    );
    res.json(rows);
  } catch (err) {
    console.error('Erro ao listar ingredientes:', err);
    res.status(500).json({ error: 'Não foi possível carregar os ingredientes.' });
  }
});

app.post('/api/ingredientes', requireAdmin, async (req, res) => {
  const { nome, precoKg } = req.body || {};
  const preco = Number(precoKg);
  if (!nome || !String(nome).trim() || !Number.isFinite(preco) || preco < 0) {
    return res.status(400).json({ error: 'Nome e preço por kg válidos são obrigatórios.' });
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO ingredientes (nome, preco_kg) VALUES ($1, $2)
       ON CONFLICT (nome) DO UPDATE SET preco_kg = EXCLUDED.preco_kg, updated_at = now()
       RETURNING id, nome, preco_kg, updated_at`,
      [String(nome).trim(), preco]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Erro ao salvar ingrediente:', err);
    res.status(500).json({ error: 'Não foi possível salvar o ingrediente.' });
  }
});

app.put('/api/ingredientes/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const { nome, precoKg } = req.body || {};
  const preco = Number(precoKg);
  if (!Number.isInteger(id) || !nome || !String(nome).trim() || !Number.isFinite(preco) || preco < 0) {
    return res.status(400).json({ error: 'Nome e preço por kg válidos são obrigatórios.' });
  }
  try {
    const { rows } = await pool.query(
      `UPDATE ingredientes SET nome = $1, preco_kg = $2, updated_at = now() WHERE id = $3
       RETURNING id, nome, preco_kg, updated_at`,
      [String(nome).trim(), preco, id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Ingrediente não encontrado.' });
    res.json(rows[0]);
  } catch (err) {
    console.error('Erro ao atualizar ingrediente:', err);
    res.status(500).json({ error: 'Não foi possível atualizar o ingrediente.' });
  }
});

app.delete('/api/ingredientes/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'Id inválido.' });
  }
  try {
    await pool.query(`DELETE FROM ingredientes WHERE id = $1`, [id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('Erro ao excluir ingrediente:', err);
    res.status(500).json({ error: 'Não foi possível excluir o ingrediente.' });
  }
});

app.get('/api/receitas', requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT prato, itens, updated_at FROM receitas`
    );
    res.json(rows);
  } catch (err) {
    console.error('Erro ao listar receitas:', err);
    res.status(500).json({ error: 'Não foi possível carregar as receitas.' });
  }
});

app.post('/api/receitas', requireAdmin, async (req, res) => {
  const { prato, itens } = req.body || {};
  if (!prato || !String(prato).trim() || !Array.isArray(itens)) {
    return res.status(400).json({ error: 'Prato e itens (lista) são obrigatórios.' });
  }
  const itensLimpos = itens
    .map((it) => ({
      ingredienteId: Number.isInteger(it && it.ingredienteId) ? it.ingredienteId : null,
      nome: String((it && it.nome) || '').trim(),
      pesoG: Number(it && it.pesoG) || 0,
      precoKg: Number(it && it.precoKg) || 0,
    }))
    .filter((it) => it.nome && it.pesoG > 0);
  try {
    const { rows } = await pool.query(
      `INSERT INTO receitas (prato, itens) VALUES ($1, $2::jsonb)
       ON CONFLICT (prato) DO UPDATE SET itens = EXCLUDED.itens, updated_at = now()
       RETURNING prato, itens, updated_at`,
      [String(prato).trim(), JSON.stringify(itensLimpos)]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Erro ao salvar receita:', err);
    res.status(500).json({ error: 'Não foi possível salvar a receita.' });
  }
});

app.get('/admin', requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'index.html'));
});

ensureSchema()
  .then(() => {
    app.listen(port, () => console.log(`Personal Chef Carolina rodando na porta ${port}`));
  })
  .catch((err) => {
    console.error('Erro ao preparar o banco de dados:', err);
    process.exit(1);
  });
