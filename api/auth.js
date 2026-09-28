const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const crypto = require("crypto");

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "1mb" }));

const User =
  mongoose.models.User ||
  mongoose.model(
    "User",
    new mongoose.Schema(
      {
        email: { type: String, unique: true, lowercase: true, trim: true, required: true },
        passwordHash: { type: String, required: true },
        salt: { type: String, required: true },
        plan: { type: String, default: "free" },
        createdAt: { type: Date, default: Date.now },
      },
      { versionKey: false }
    )
  );

const Session =
  mongoose.models.AuthSession ||
  mongoose.model(
    "AuthSession",
    new mongoose.Schema(
      {
        tokenHash: { type: String, unique: true, required: true, index: true },
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
        expiresAt: { type: Date, required: true, index: { expires: 0 } },
        createdAt: { type: Date, default: Date.now },
        lastActivityAt: { type: Date, default: Date.now },
      },
      { versionKey: false }
    )
  );

let dbPromise = null;

// Configuration constants for session expiry
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7; // 7 days
const INACTIVITY_TIMEOUT_SECONDS = 60 * 60; // 1 hour of inactivity
const WARNING_BEFORE_EXPIRY_SECONDS = 60 * 5; // Warn 5 minutes before expiry

function configError() {
  if (!process.env.MONGODB_URI) {
    return "Database is not configured. Add MONGODB_URI to Vercel Environment Variables.";
  }
  return null;
}

async function db() {
  if (!process.env.MONGODB_URI) {
    throw new Error("Database is not configured. Add MONGODB_URI to Vercel Environment Variables.");
  }

  if (mongoose.connection.readyState === 1) return;

  if (!dbPromise) {
    dbPromise = mongoose
      .connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 8000,
        connectTimeoutMS: 8000,
        maxPoolSize: 5,
      })
      .catch((error) => {
        dbPromise = null;
        throw error;
      });
  }

  await dbPromise;
}

function hash(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString("hex");
}

function hashSessionToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function getCookie(req, name) {
  const cookies = String(req.headers.cookie || "").split(";");
  const prefix = name + "=";

  for (const cookie of cookies) {
    const value = cookie.trim();
    if (value.startsWith(prefix)) {
      return decodeURIComponent(value.slice(prefix.length));
    }
  }

  return "";
}

function setSessionCookie(res, token, maxAgeSeconds) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader(
    "Set-Cookie",
    "ai_session=" +
      encodeURIComponent(token) +
      "; Path=/; HttpOnly; SameSite=Lax; Max-Age=" +
      maxAgeSeconds +
      secure
  );
}

function clearSessionCookie(res) {
  res.setHeader(
    "Set-Cookie",
    "ai_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0" +
      (process.env.NODE_ENV === "production" ? "; Secure" : "")
  );
}

async function createSession(userId) {
  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DURATION_SECONDS * 1000);

  await Session.create({
    tokenHash: hashSessionToken(token),
    userId,
    expiresAt,
    lastActivityAt: new Date(),
  });

  return { token, maxAgeSeconds: SESSION_DURATION_SECONDS, expiresAt };
}

async function requireAuth(req, res, next) {
  try {
    await db();

    const token = getCookie(req, "ai_session");

    if (!token) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const session = await Session.findOne({
      tokenHash: hashSessionToken(token),
      expiresAt: { $gt: new Date() },
    }).lean();

    if (!session) {
      clearSessionCookie(res);
      return res.status(401).json({ error: "Session expired. Please login again." });
    }

    // Update last activity timestamp
    await Session.updateOne(
      { _id: session._id },
      { lastActivityAt: new Date() }
    );

    const user = await User.findById(session.userId)
      .select("email plan createdAt")
      .lean();

    if (!user) {
      await Session.deleteOne({ _id: session._id });
      clearSessionCookie(res);
      return res.status(401).json({ error: "User not found" });
    }

    req.auth = {
      sub: String(user._id),
      email: user.email,
      plan: user.plan,
      sessionExpiresAt: session.expiresAt,
      sessionId: String(session._id),
    };

    next();
  } catch (error) {
    console.error("AUTH MIDDLEWARE ERROR:", error);
    const message = safeError(error, "Authentication service unavailable");

    return res.status(message.startsWith("Database") ? 503 : 500).json({
      error: message,
    });
  }
}

function safeError(error, fallback) {
  const message = String(error?.message || "").toLowerCase();

  if (
    message.includes("authentication failed") ||
    message.includes("bad auth") ||
    error?.code === 8000
  ) {
    return "Database authentication failed. Check the MongoDB Atlas Database Access username/password in MONGODB_URI.";
  }

  if (
    error?.name === "MongooseServerSelectionError" ||
    error?.name === "MongoServerSelectionError" ||
    error?.code === "ENOTFOUND"
  ) {
    return "Database connection failed. Check MONGODB_URI and MongoDB Atlas Network Access.";
  }

  if (
    error?.name === "MongoNetworkError" ||
    error?.code === "ECONNREFUSED"
  ) {
    return "Database connection was refused. Check MongoDB Atlas Network Access.";
  }

  if (error?.code === 11000) {
    return "Account already exists";
  }

  return error?.message || fallback;
}

app.get("/api/auth/health", async (req, res) => {
  const configurationError = configError();

  if (configurationError) {
    return res.status(503).json({
      ok: false,
      database: "not configured",
      error: configurationError,
    });
  }

  try {
    await db();

    return res.status(200).json({
      ok: true,
      database: "connected",
      authentication: "session-based",
    });
  } catch (error) {
    return res.status(503).json({
      ok: false,
      database: "unavailable",
      error: safeError(error, "Authentication service unavailable"),
    });
  }
});

app.post("/api/auth/register", async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({ error: "Enter a valid email address" });
    }

    if (password.length < 8) {
      return res.status(400).json({
        error: "Password must contain at least 8 characters",
      });
    }

    const configurationError = configError();

    if (configurationError) {
      return res.status(503).json({ error: configurationError });
    }

    await db();

    const existingUser = await User.findOne({ email }).lean();

    if (existingUser) {
      return res.status(409).json({ error: "Account already exists" });
    }

    const salt = crypto.randomBytes(16).toString("hex");
    const passwordHash = hash(password, salt);

    const user = await User.create({
      email,
      salt,
      passwordHash,
    });

    const session = await createSession(user._id);
    setSessionCookie(res, session.token, session.maxAgeSeconds);

    return res.status(201).json({
      user: {
        id: String(user._id),
        email: user.email,
        plan: user.plan,
      },
      sessionExpiresAt: session.expiresAt,
    });
  } catch (error) {
    console.error("REGISTER ERROR:", error);

    if (error?.code === 11000) {
      return res.status(409).json({ error: "Account already exists" });
    }

    const message = safeError(error, "Registration failed");

    return res.status(message.startsWith("Database") ? 503 : 500).json({
      error: message,
    });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");

    if (!/^\S+@\S+\.\S+$/.test(email) || !password) {
      return res.status(400).json({
        error: "Enter a valid email and password",
      });
    }

    const configurationError = configError();

    if (configurationError) {
      return res.status(503).json({ error: configurationError });
    }

    await db();

    const user = await User.findOne({ email }).lean();

    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const passwordHash = hash(password, user.salt);

    if (passwordHash !== user.passwordHash) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const session = await createSession(user._id);
    setSessionCookie(res, session.token, session.maxAgeSeconds);

    return res.status(200).json({
      user: {
        id: String(user._id),
        email: user.email,
        plan: user.plan,
      },
      sessionExpiresAt: session.expiresAt,
    });
  } catch (error) {
    console.error("LOGIN ERROR:", error);

    const message = safeError(error, "Login failed");

    return res.status(message.startsWith("Database") ? 503 : 500).json({
      error: message,
    });
  }
});

app.post("/api/auth/logout", async (req, res) => {
  try {
    if (process.env.MONGODB_URI) {
      await db();
      const token = getCookie(req, "ai_session");

      if (token) {
        await Session.deleteOne({ tokenHash: hashSessionToken(token) });
      }
    }

    clearSessionCookie(res);
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("LOGOUT ERROR:", error);
    clearSessionCookie(res);
    return res.status(200).json({ ok: true });
  }
});

app.get("/api/auth/me", requireAuth, async (req, res) => {
  try {
    await db();

    const user = await User.findById(req.auth.sub)
      .select("email plan createdAt")
      .lean();

    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    const timeUntilExpiry = new Date(req.auth.sessionExpiresAt).getTime() - Date.now();
    const isExpiring = timeUntilExpiry < WARNING_BEFORE_EXPIRY_SECONDS * 1000;

    return res.status(200).json({
      user: {
        id: String(user._id),
        email: user.email,
        plan: user.plan,
        createdAt: user.createdAt,
      },
      sessionExpiresAt: req.auth.sessionExpiresAt,
      sessionWarning: isExpiring ? "Session expiring soon. Please refresh or login again." : null,
    });
  } catch (error) {
    console.error("ME ERROR:", error);

    const message = safeError(error, "Session validation failed");

    return res.status(message.startsWith("Database") ? 503 : 500).json({
      error: message,
    });
  }
});

// Refresh session endpoint - extends the session expiry
app.post("/api/auth/refresh", requireAuth, async (req, res) => {
  try {
    await db();

    const token = getCookie(req, "ai_session");

    if (!token) {
      return res.status(401).json({ error: "No active session" });
    }

    const session = await Session.findOne({
      tokenHash: hashSessionToken(token),
    });

    if (!session) {
      return res.status(401).json({ error: "Session not found" });
    }

    // Extend session expiry by SESSION_DURATION_SECONDS
    const newExpiresAt = new Date(Date.now() + SESSION_DURATION_SECONDS * 1000);
    await Session.updateOne(
      { _id: session._id },
      { expiresAt: newExpiresAt, lastActivityAt: new Date() }
    );

    setSessionCookie(res, token, SESSION_DURATION_SECONDS);

    return res.status(200).json({
      ok: true,
      sessionExpiresAt: newExpiresAt,
      message: "Session extended successfully",
    });
  } catch (error) {
    console.error("REFRESH ERROR:", error);

    const message = safeError(error, "Session refresh failed");

    return res.status(message.startsWith("Database") ? 503 : 500).json({
      error: message,
    });
  }
});

// Logout all sessions endpoint (security feature)
app.post("/api/auth/logout-all", requireAuth, async (req, res) => {
  try {
    await db();

    await Session.deleteMany({ userId: req.auth.sub });

    clearSessionCookie(res);
    return res.status(200).json({ ok: true, message: "All sessions terminated" });
  } catch (error) {
    console.error("LOGOUT_ALL ERROR:", error);
    clearSessionCookie(res);
    return res.status(200).json({ ok: true });
  }
});

app.requireAuth = requireAuth;

module.exports = app;
