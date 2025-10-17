import express from "express";
import fetch from "node-fetch";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Récupère la clé depuis une variable d'environnement (ne laisse pas la clé dans le code)
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

app.use(express.json());

// CORS basique pour dev local
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

// Servir les fichiers statiques depuis le dossier "public"
app.use(express.static(path.join(__dirname, "public")));

// endpoint de vérification
app.get("/status", (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

// Serve index.html at root
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Fallback pour SPA — utiliser regex /.*/ pour éviter path-to-regexp errors
app.get(/.*/, (req, res) => {
  if (req.path.startsWith("/api/")) return res.status(404).json({ error: "API route not found" });
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.post("/api/gemini", async (req, res) => {
  console.log("POST /api/gemini reçu", new Date().toISOString());

  if (!GEMINI_API_KEY) {
    console.error("Clé Gemini manquante. Définir GEMINI_API_KEY en variable d'environnement.");
    return res.status(500).json({ error: "Clé Gemini manquante sur le serveur." });
  }

  const { userName, answers = [], questions = [] } = req.body || {};
  const systemPrompt = `Agis en tant que consultant en stratégie IA de classe mondiale. Ta mission est de synthétiser les réponses fournies par un dirigeant d'entreprise pour formuler une proposition de vision claire, concise et inspirante pour l'intégration de l'intelligence artificielle dans son organisation. Adresse-toi à ${userName || "dirigeant"}.`;
  let userQuery = `Voici les réponses de ${userName || "utilisateur"} :\n\n`;
  questions.forEach((q, i) => (userQuery += `Q: ${q}\nR: ${answers[i] || "Non spécifié"}\n\n`));

  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${GEMINI_API_KEY}`;
  const payload = { contents: [{ parts: [{ text: userQuery }] }], systemInstruction: { parts: [{ text: systemPrompt }] } };

  try {
    console.log("Appel Gemini ->", apiUrl);
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const text = await response.text();
    let result;
    try {
      result = JSON.parse(text);
    } catch (e) {
      result = { raw: text };
    }

    console.log("Gemini status:", response.status);

    if (!response.ok) {
      console.error("Gemini API error:", response.status, result);
      return res.status(response.status).json({ error: "Erreur API Gemini", details: result });
    }

    return res.json(result);
  } catch (err) {
    console.error("Erreur lors de l'appel à Gemini:", err);
    return res.status(500).json({ error: "Erreur serveur lors de l'appel à Gemini", detail: String(err) });
  }
});

app.listen(PORT, () => console.log(`Serveur lancé sur http://localhost:${PORT}`));