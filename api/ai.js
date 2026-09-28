const authApp = require("./auth.js");
const requireAuth = authApp.requireAuth;
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(requireAuth);

const Resume =
  mongoose.models.Resume ||
  mongoose.model(
    "Resume",
    new mongoose.Schema({
      role: String,
      section: String,
      content: String,
      answer: String,
      createdAt: { type: Date, default: Date.now },
    })
  );

let dbPromise = null;

async function db() {
  if (!process.env.MONGODB_URI) return false;
  if (mongoose.connection.readyState === 1) return true;

  if (!dbPromise) {
    dbPromise = mongoose
      .connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 8000,
        connectTimeoutMS: 8000,
        maxPoolSize: 5,
      })
      .then(() => true)
      .catch((error) => {
        dbPromise = null;
        throw error;
      });
  }

  await dbPromise;
  return true;
}

app.get("/api/health", (req, res) =>
  res.json({ ok: true, service: "AI Resume Builder", stack: "MERN + AI" })
);

app.post("/api/ai", async (req, res) => {
  const {
    section = "summary",
    content = "",
    role = "MERN Stack Developer",
  } = req.body || {};

  if (!content.trim()) {
    return res.status(400).json({ error: "Content is required" });
  }

  const prompt =
    "Improve this resume section for an " +
    role +
    " role. Section: " +
    section +
    ". Make it concise, ATS-friendly, achievement-oriented and truthful. Preserve facts and do not invent employers, metrics or credentials. Return only the improved section.\n\nCONTENT:\n" +
    content;

  try {
    let answer;

    if (!process.env.OPENAI_API_KEY) {
      answer =
        "Demo mode: add OPENAI_API_KEY to Vercel for live resume optimization.\n\n" +
        content;
    } else {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + process.env.OPENAI_API_KEY,
        },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || "gpt-4o-mini",
          temperature: 0.25,
          messages: [
            {
              role: "system",
              content: "You are an expert technical resume editor.",
            },
            { role: "user", content: prompt },
          ],
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || "AI provider error");
      }

      answer = data.choices?.[0]?.message?.content || content;
    }

    if (process.env.MONGODB_URI) {
      await db();
      await Resume.create({ role, section, content, answer });
    }

    return res.json({ answer });
  } catch (error) {
    console.error("AI ERROR:", error);
    return res.status(500).json({ error: error.message || "AI request failed" });
  }
});

module.exports = app;
