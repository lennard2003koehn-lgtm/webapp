const express = require("express");

const app = express();
app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: false }));

// In-Memory "Datenbank" (RAM)
// Hinweis: Bei Neustart/Deploy ist die Liste wieder leer.
let nextId = 1;
const todos = [];

app.get("/", (req, res) => {
  // Neueste zuerst
  const sorted = [...todos].sort((a, b) => b.id - a.id);
  res.render("index", { todos: sorted });
});

// Dynamisch nachweisbar: POST verarbeitet Eingabe und verändert serverseitigen Zustand (Array)
app.post("/add", (req, res) => {
  const text = (req.body.text || "").trim();
  if (text.length === 0) return res.redirect("/");

  todos.push({
    id: nextId++,
    text,
    done: false,
    created_at: new Date().toISOString()
  });

  res.redirect("/");
});

app.post("/toggle/:id", (req, res) => {
  const id = Number(req.params.id);
  const t = todos.find(x => x.id === id);
  if (t) t.done = !t.done;
  res.redirect("/");
});

app.post("/delete/:id", (req, res) => {
  const id = Number(req.params.id);
  const idx = todos.findIndex(x => x.id === id);
  if (idx !== -1) todos.splice(idx, 1);
  res.redirect("/");
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Listening on ${port}`));
