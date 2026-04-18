import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import cors from "cors";
import { open } from "sqlite";
import { adminAuth, checkBlockedUser } from "./middleware.js";
import sqlite3 from "sqlite3";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* =========================
   GLOBAL CRASH GUARDS
   Prevent ANY unhandled error from taking the whole server down.
========================= */
process.on("unhandledRejection", (reason, promise) => {
  console.error("⚠️  [UnhandledRejection] Caught — server kept alive.");
  console.error("   Reason:", reason?.message || reason);
});

process.on("uncaughtException", (err) => {
  console.error("⚠️  [UncaughtException] Caught — server kept alive.");
  console.error("   Error:", err.message);
});

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

/* =========================
   GLOBAL STATE (ADMIN CONTROL)
========================= */
let LLM_ENABLED = true;
let CURRENT_MODEL = "gemini";
// List of all models the admin has added (shown in the frontend dropdown)
let AVAILABLE_MODELS = [
  { id: "gemini", label: "✨ Gemini 2.5 (Google)", provider: "gemini" },
  {
    id: "meta-llama/Llama-3.2-1B-Instruct",
    label: "🤗 Llama 3.2 1B (HuggingFace)",
    provider: "huggingface",
  },
];

/* =========================
   RATE LIMIT
   Only limit expensive chat calls. A global limiter counts page assets,
   videos, history calls, and model-list requests as "AI requests".
========================= */
const chatLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 25,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message:
      "Too many chat requests. Please wait a few minutes and try again.",
  },
});

/* =========================
   AI SETUP
========================= */
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const geminiModel = genAI.getGenerativeModel({
  model: "gemini-2.5-flash",
});

/* =========================
   SYSTEM PROMPT
========================= */
const SYSTEM_PROMPT = `
You are MediAI, a helpful, concise medical assistant.
Give short, structured answers with medicines and remedies.
Add a small disclaimer at the end.
`;

async function callHuggingFaceChat(model, content) {
  const hfResponse = await fetch(
    "https://router.huggingface.co/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.HF_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content },
        ],
        max_tokens: 512,
      }),
    },
  );

  let data = null;
  try {
    data = await hfResponse.json();
  } catch {
    data = null;
  }

  if (!hfResponse.ok) {
    const providerMessage =
      data?.error?.message ||
      data?.message ||
      data?.error ||
      `Hugging Face returned HTTP ${hfResponse.status}`;

    if (hfResponse.status === 401) {
      return "Hugging Face authentication failed. Please check HF_TOKEN on the server.";
    }
    if (hfResponse.status === 402 || hfResponse.status === 403) {
      return `This model is not available for your Hugging Face account/token: ${model}. ${providerMessage}`;
    }
    if (hfResponse.status === 404) {
      return `Model not found or not supported by Hugging Face Router: ${model}. Please check the model ID and provider.`;
    }
    if (hfResponse.status === 429) {
      return "Hugging Face is rate limiting this token/model right now. Please wait and try again, or switch to Gemini.";
    }

    return `Model error (${hfResponse.status}): ${providerMessage}`;
  }

  console.log(
    "HF RESPONSE summary:",
    data?.model,
    "—",
    data?.usage?.total_tokens,
    "tokens",
  );

  const text = data?.choices?.[0]?.message?.content;
  if (typeof text === "string" && text.trim()) {
    return text;
  }

  return `No text response returned by model: ${model}. This model may not support chat completions through Hugging Face Router.`;
}

/* =========================
   DATABASE
========================= */
let db;

async function setupDB() {
  db = await open({
    filename: "./storage.db",
    driver: sqlite3.Database,
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT,
      session_id TEXT,
      role TEXT,
      content TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      attachments TEXT DEFAULT '[]'
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS blocked_users (
      user_id TEXT PRIMARY KEY
    )
  `);

  console.log("✅ Database connected");
}

/* =========================
   ADMIN AUTH
========================= */
// function adminAuth(req, res, next) {
//   const token = req.headers.authorization;

//   if (token === "admin-token") {
//     next();
//   } else {
//     res.status(403).json({ success: false, message: "Unauthorized" });
//   }
// }

/* =========================
   ADMIN ROUTES
========================= */

/* Login */
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

/* Status */
app.get("/api/admin/status", adminAuth, async (req, res) => {
  const blockedUsersRows = await db.all(`SELECT * FROM blocked_users`);
  const blockedUsers = blockedUsersRows.map((r) => r.user_id);
  res.json({
    success: true,
    enabled: LLM_ENABLED,
    model: CURRENT_MODEL,
    blockedUsers,
    models: AVAILABLE_MODELS,
  });
});

/* Add Model */
app.post("/api/admin/add-model", adminAuth, (req, res) => {
  const { id, label, provider } = req.body;
  if (!id || !label || !provider) {
    return res
      .status(400)
      .json({
        success: false,
        message: "id, label, and provider are required",
      });
  }
  // Don't add duplicates
  if (!AVAILABLE_MODELS.find((m) => m.id === id)) {
    AVAILABLE_MODELS.push({ id, label, provider });
  }
  res.json({ success: true, models: AVAILABLE_MODELS });
});

/* Get Models (public, for frontend dropdown) */
app.get("/api/models", (req, res) => {
  res.json({ success: true, models: AVAILABLE_MODELS });
});

/* Toggle LLM */
app.post("/api/admin/toggle-llm", adminAuth, (req, res) => {
  LLM_ENABLED = !LLM_ENABLED;
  res.json({ enabled: LLM_ENABLED });
});

/* Set Model */
app.post("/api/admin/set-model", adminAuth, (req, res) => {
  const { model } = req.body;
  CURRENT_MODEL = model;
  res.json({ model: CURRENT_MODEL });
});

/* Find User by Email (calls Clerk backend API) */
app.get("/api/admin/find-user", adminAuth, async (req, res) => {
  const { email } = req.query;
  if (!email)
    return res
      .status(400)
      .json({ success: false, message: "email query param required" });

  const clerkSecretKey = process.env.CLERK_SECRET_KEY;
  if (!clerkSecretKey) {
    return res
      .status(500)
      .json({ success: false, message: "CLERK_SECRET_KEY is not set in .env" });
  }

  try {
    const clerkRes = await fetch(
      `https://api.clerk.com/v1/users?email_address=${encodeURIComponent(email)}`,
      {
        headers: {
          Authorization: `Bearer ${clerkSecretKey}`,
          "Content-Type": "application/json",
        },
      },
    );

    const clerkData = await clerkRes.json();

    if (!clerkRes.ok) {
      return res
        .status(clerkRes.status)
        .json({
          success: false,
          message: clerkData.errors?.[0]?.message || "Clerk API error",
        });
    }

    if (!Array.isArray(clerkData) || clerkData.length === 0) {
      return res.json({
        success: false,
        message: "No user found with that email address.",
      });
    }

    const user = clerkData[0];
    return res.json({
      success: true,
      userId: user.id,
      firstName: user.first_name || "",
      lastName: user.last_name || "",
      email: user.email_addresses?.[0]?.email_address || email,
      imageUrl: user.image_url || null,
    });
  } catch (err) {
    console.error("Clerk lookup error:", err);
    res
      .status(500)
      .json({ success: false, message: "Failed to reach Clerk API." });
  }
});

/* Block User */
app.post("/api/admin/block-user", adminAuth, async (req, res) => {
  const { userId, removeData } = req.body;

  await db.run(`INSERT OR IGNORE INTO blocked_users (user_id) VALUES (?)`, [
    userId,
  ]);

  if (removeData) {
    await db.run(`DELETE FROM messages WHERE user_id = ?`, [userId]);
  }

  res.json({ success: true });
});

/* Unblock User */
app.post("/api/admin/unblock-user", adminAuth, async (req, res) => {
  const { userId } = req.body;
  if (!userId)
    return res.status(400).json({ success: false, message: "userId required" });

  await db.run(`DELETE FROM blocked_users WHERE user_id = ?`, [userId]);
  res.json({ success: true });
});

/* Delete All User Data (messages only, no block) */
app.post("/api/admin/delete-user-data", adminAuth, async (req, res) => {
  const { userId } = req.body;
  if (!userId)
    return res.status(400).json({ success: false, message: "userId required" });

  const result = await db.run(`DELETE FROM messages WHERE user_id = ?`, [
    userId,
  ]);
  res.json({ success: true, deleted: result.changes });
});

/* =========================
   CHAT API
========================= */

app.post("/api/chat", chatLimiter, async (req, res) => {
  await checkBlockedUser(db, req, res, async () => {
    try {
      const { content, userId, sessionId, modelChoice } = req.body;

      if (!content) {
        return res.status(400).json({ message: "content required" });
      }

      /* Block check */
      const blocked = await db.get(
        `SELECT * FROM blocked_users WHERE user_id = ?`,
        [userId],
      );

      if (blocked) {
        return res.status(403).json({
          message: "You are blocked by admin",
        });
      }

      /* LLM OFF */
      if (!LLM_ENABLED) {
        return res.json({
          message: "AI is temporarily disabled by admin",
        });
      }

      /* Save user */
      await db.run(
        `INSERT INTO messages (user_id, session_id, role, content)
       VALUES (?, ?, ?, ?)`,
        [userId, sessionId, "user", content],
      );

      let aiResponseText = "";

      // Determine which model to use:
      // User's per-request choice takes priority; admin CURRENT_MODEL is the fallback default.
      const modelToUse =
        modelChoice && modelChoice.trim() ? modelChoice.trim() : CURRENT_MODEL;
      const modelMeta = AVAILABLE_MODELS.find((m) => m.id === modelToUse);
      const provider = modelMeta
        ? modelMeta.provider
        : modelToUse === "gemini"
          ? "gemini"
          : "huggingface";

      /* ─── CALL AI ─── */
      if (provider === "gemini") {
        try {
          const result = await geminiModel.generateContent(
            `${SYSTEM_PROMPT}\nUser: ${content}`,
          );
          aiResponseText = result.response.text();
        } catch (geminiErr) {
          // Gemini 503/overloaded → auto-fallback to Llama (HuggingFace)
          const is503 =
            geminiErr?.status === 503 || geminiErr?.message?.includes("503");
          if (is503) {
            console.warn(
              "⚡ Gemini 503 — auto-falling back to Llama (HuggingFace)",
            );
            const fallbackModel = "meta-llama/Llama-3.2-1B-Instruct";
            aiResponseText = await callHuggingFaceChat(
              fallbackModel,
              content,
            );
            // Prefix so the user knows what happened
            aiResponseText = `_(Gemini busy, responded via Llama)_\n\n${aiResponseText}`;
          } else {
            throw geminiErr; // rethrow non-503 Gemini errors
          }
        }
      } else {
        /* HUGGING FACE */
        aiResponseText = await callHuggingFaceChat(modelToUse, content);
      }

      /* Save AI response */
      await db.run(
        `INSERT INTO messages (user_id, session_id, role, content)
       VALUES (?, ?, ?, ?)`,
        [userId, sessionId, "assistant", aiResponseText],
      );

      res.json({ success: true, message: aiResponseText });
    } catch (error) {
      console.error("❌ Chat route error (handled):", error.message);
      // Always respond — never leave the request hanging
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: `Server error: ${error.message}`,
        });
      }
    }
  });
});

/* =========================
   SESSION & HISTORY API
========================= */

app.get("/api/sessions/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    // Just grab the session info using the correct 'timestamp' column
    const rows = await db.all(
      `SELECT session_id, 
              MIN(timestamp) as started_at, 
              content 
       FROM messages 
       WHERE user_id = ? AND role = 'user' 
       GROUP BY session_id 
       ORDER BY started_at DESC`,
      [userId],
    );

    const sessions = rows.map((r) => ({
      id: r.session_id,
      title:
        r.content.length > 25 ? r.content.substring(0, 25) + "..." : r.content,
      created_at: r.started_at,
    }));

    res.json({ success: true, sessions });
  } catch (error) {
    console.error("Sessions Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get("/api/history/:userId/:sessionId", async (req, res) => {
  try {
    const { userId, sessionId } = req.params;

    const messages = await db.all(
      `SELECT * FROM messages WHERE user_id = ? AND session_id = ? ORDER BY id ASC`,
      [userId, sessionId],
    );

    const formattedMessages = messages.map((m) => ({
      ...m,
      created_at: m.timestamp || m.created_at,
    }));

    res.json({ success: true, messages: formattedMessages });
  } catch (error) {
    console.error("History Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.delete("/api/history/:userId/:sessionId", async (req, res) => {
  try {
    const { userId, sessionId } = req.params;

    await db.run(`DELETE FROM messages WHERE user_id = ? AND session_id = ?`, [
      userId,
      sessionId,
    ]);

    res.json({ success: true });
  } catch (error) {
    console.error("Delete Session Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/* =========================
   FRONTEND (PRODUCTION)
========================= */
const distPath = path.join(__dirname, "dist");

app.use(express.static(distPath));

app.get(/^\/(?!api).*/, (req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

/* =========================
   START SERVER
========================= */
setupDB()
  .then(() => {
    const server = app.listen(PORT, "0.0.0.0", () => {
      console.log(`\n🚀 Server running on port ${PORT}`);
      console.log(`   Press Ctrl+C to stop.\n`);
    });

    // Handle port-already-in-use gracefully — kill old process then restart
    server.on("error", (err) => {
      if (err.code === "EADDRINUSE") {
        console.error(`\n❌ Port ${PORT} is already in use!`);
        console.error(
          `   Run this to free it:  Stop-Process -Name node -Force`,
        );
        console.error(`   Then run:             node server.js\n`);
        process.exit(1); // Exit with error so nodemon can restart
      } else {
        console.error("Server error:", err);
      }
    });
  })
  .catch((err) => {
    console.error("❌ Failed to start server:", err);
    process.exit(1);
  });
