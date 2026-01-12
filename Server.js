const express = require("express");
const { Pool } = require("pg");

const app = express();
app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: false }));

// Railway/Render liefern i.d.R. DATABASE_URL als Env-Var
if (!process.env.DATABASE_URL) {
  console.error("Missing DATABASE_URL env var");
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes("sslmode=") ? undefined : { rejectUnauthorized: false }
});

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS todos (
      id SERIAL PRIMARY KEY,
      text TEXT NOT NULL,
      done BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

app.get("/", async (req, res) => {
  const { rows } = await pool.query(
    "SELECT id, text, done, created_at FROM todos ORDER BY id DESC;"
  );
  res.render("index", { todos: rows });
});

// Dynamisch nachweisbar: POST verarbeitet Formulardaten und speichert in DB
app.post("/add", async (req, res) => {
  const text = (req.body.text || "").trim();
  if (text.length === 0) return res.redirect("/");
  await pool.query("INSERT INTO todos(text) VALUES ($1);", [text]);
  res.redirect("/");
});

app.post("/toggle/:id", async (req, res) => {
  const id = Number(req.params.id);
  await pool.query("UPDATE todos SET done = NOT done WHERE id = $1;", [id]);
  res.redirect("/");
});

app.post("/delete/:id", async (req, res) => {
  const id = Number(req.params.id);
  await pool.query("DELETE FROM todos WHERE id = $1;", [id]);
  res.redirect("/");
});

const port = process.env.PORT || 3000;

initDb()
  .then(() => app.listen(port, () => console.log(`Listening on ${port}`)))
  .catch((err) => {
    console.error("DB init failed:", err);
    process.exit(1);
  });
