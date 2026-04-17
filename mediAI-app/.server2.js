import express from "express";
import cors from "cors";
import { open } from "sqlite";
import sqlite3 from "sqlite3";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";
import { OpenAI } from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();
console.log("HF token loaded:", process.env.HF_TOKEN ? "YES" : "NO");

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

/* =========================
   RATE LIMIT
========================= */
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 50,
    message: {
      success: false,
      message: "Too many requests. Try again later.",
    },
  }),
);

/* =========================
   AI MODELS
========================= */
const client = new OpenAI({
  baseURL: "https://router.huggingface.co/v1",
  apiKey: process.env.HF_TOKEN,
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const geminiModel = genAI.getGenerativeModel({
  model: "gemini-2.5-flash",
});

/* =========================
   SYSTEM PROMPT
========================= */
const SYSTEM_PROMPT = `
You are MediAI, a helpful, knowledgeable, and concise AI medical assistant. 
When asked about common ailments (like fever, cold, headache), provide direct, practical medicine names (e.g., Paracetamol, Acetaminophen, Ibuprofen) and clear home remedies immediately without asking too many follow-up questions.
Keep your answers brief, friendly, and highly structured. Give them exactly what they ask for right away.
Include only a very brief, single-sentence medical disclaimer at the very end. Do not overwhelm the user with long emergency warnings unless they explicitly describe severe or dangerous symptoms.
`;

let db;

/* =========================
   DATABASE SETUP
========================= */
async function setupDB() {
  db = await open({
    filename: "./storage.db",
    driver: sqlite3.Database,
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Auto-migrate old database schema to include session_id, attachments, etc
  try {
    await db.exec(
      "ALTER TABLE messages ADD COLUMN user_id TEXT DEFAULT 'default-user'",
    );
  } catch (e) {}

  try {
    await db.exec(
      "ALTER TABLE messages ADD COLUMN session_id TEXT DEFAULT 'default'",
    );
  } catch (e) {}

  try {
    await db.exec(
      "ALTER TABLE messages ADD COLUMN attachments TEXT DEFAULT '[]'",
    );
    console.log("✅ Database migrated: Added attachments column");
  } catch (e) {}

  console.log("✅ Database connected");
}

/* =========================
   GET USER HISTORY
========================= */
app.get("/api/history/:userId/:sessionId", async (req, res) => {
  try {
    const { userId, sessionId } = req.params;

    const messages = await db.all(
      `SELECT * FROM messages 
       WHERE user_id = ? AND session_id = ?
       ORDER BY id ASC`,
      [userId, sessionId],
    );

    res.json({
      success: true,
      messages,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch history",
    });
  }
});

/* =========================
   GET RECENT SESSIONS
========================= */
app.get("/api/sessions/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const sessions = await db.all(
      `SELECT session_id as id, content as title 
       FROM messages 
       WHERE user_id = ? AND role = 'user' 
       GROUP BY session_id 
       ORDER BY MIN(id) DESC LIMIT 10`,
      [userId],
    );
    res.json({ success: true, sessions });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false });
  }
});

/* =========================
   CLEAR SESSION HISTORY
========================= */
app.delete("/api/history/:userId/:sessionId", async (req, res) => {
  try {
    const { userId, sessionId } = req.params;

    await db.run(`DELETE FROM messages WHERE user_id = ? AND session_id = ?`, [
      userId,
      sessionId,
    ]);

    res.json({
      success: true,
      message: "Session deleted",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to delete session",
    });
  }
});

/* =========================
   Admin Login
========================= */

app.post("/api/admin/login", (req, res) => {
  const { username, password } = req.body;

  if (
    username === process.env.ADMIN_USERNAME &&
    password === process.env.ADMIN_PASSWORD
  ) {
    return res.json({ success: true, token: "admin-token" });
  }

  res.status(401).json({ success: false });
});

/* =========================
   CHAT API
========================= */
app.post("/api/chat", async (req, res) => {
  console.log("BODY:", req.body);

  try {
    const { content, files, modelChoice, userId, sessionId } = req.body;

    if (!content && (!files || files.length === 0)) {
      return res.status(400).json({
        success: false,
        message: "content or files required",
      });
    }

    /* Save user message */
    await db.run(
      `INSERT INTO messages (user_id, session_id, role, content, attachments)
       VALUES (?, ?, ?, ?, ?)`,
      [
        userId || "default-user",
        sessionId || "default",
        "user",
        content || "",
        JSON.stringify(files || []),
      ],
    );

    /* Get history */
    const historyRows = await db.all(
      `SELECT role, content, attachments
       FROM messages
       WHERE user_id = ? AND session_id = ?
       ORDER BY id DESC
       LIMIT 6`,
      [userId || "default-user", sessionId || "default"],
    );

    let aiResponseText = "";

    /* Gemini */
    if (modelChoice === "gemini") {
      const history = historyRows.reverse().map((row) => {
        let parts = [{ text: row.content }];

        try {
          const parsedFiles = JSON.parse(row.attachments || "[]");

          parsedFiles.forEach((f) => {
            if (f.type === "image" && f.url && f.url.startsWith("data:")) {
              const mimeType = f.url.split(";")[0].split(":")[1];
              const data = f.url.split(",")[1];

              parts.push({
                inlineData: {
                  data,
                  mimeType,
                },
              });
            }
          });
        } catch (e) {}

        return {
          role: row.role === "assistant" ? "model" : "user",
          parts,
        };
      });

      const chat = geminiModel.startChat({
        history: history.slice(0, -1),
      });

      const lastMessageParts = history[history.length - 1].parts;

      lastMessageParts[0].text = `${SYSTEM_PROMPT}\n\nUser: ${lastMessageParts[0].text}`;

      const result = await chat.sendMessage(lastMessageParts);

      aiResponseText = result.response.text();
    } else {
      /* Hugging Face / Gemma */
      const messages = [
        { role: "system", content: SYSTEM_PROMPT },
        ...historyRows.reverse().map((row) => ({
          role: row.role,
          content: row.content,
        })),
      ];

      const hfResponse = await fetch(
        "https://router.huggingface.co/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.HF_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            inputs: messages.map((m) => `${m.role}: ${m.content}`).join("\n"),
          }),
        },
      );

      const hfData = await hfResponse.json();

      console.log("HF RESPONSE:", hfData);

      aiResponseText =
        hfData?.[0]?.generated_text || hfData?.generated_text || "No response";
    }

    /* Save AI response */
    await db.run(
      `INSERT INTO messages (user_id, session_id, role, content)
       VALUES (?, ?, ?, ?)`,
      [
        userId || "default-user",
        sessionId || "default",
        "assistant",
        aiResponseText,
      ],
    );

    /* Return updated history */
    const updatedMessages = await db.all(
      `SELECT * FROM messages
       WHERE user_id = ? AND session_id = ?
       ORDER BY id ASC`,
      [userId || "default-user", sessionId || "default"],
    );

    res.json({
      success: true,
      messages: updatedMessages,
    });
  } catch (error) {
    console.error("API Error:", error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});
/* =========================
   START SERVER
========================= */
setupDB().then(() => {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server running on ${PORT}`);
  });
});
