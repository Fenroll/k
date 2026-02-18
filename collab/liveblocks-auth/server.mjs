import express from "express";
import cors from "cors";
import { Liveblocks } from "@liveblocks/node";

const app = express();
app.use(express.json({ limit: "64kb" }));

const allowedOrigins = String(process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Origin not allowed by CORS"));
    },
    credentials: false,
  })
);

const liveblocksSecret = process.env.LIVEBLOCKS_SECRET_KEY;
const firebaseDbUrl = String(process.env.FIREBASE_DB_URL || "").replace(/\/$/, "");

if (!liveblocksSecret) {
  throw new Error("Missing LIVEBLOCKS_SECRET_KEY");
}
if (!firebaseDbUrl) {
  throw new Error("Missing FIREBASE_DB_URL");
}

const liveblocks = new Liveblocks({ secret: liveblocksSecret });

async function loadFirebaseUser(userId) {
  const encodedId = encodeURIComponent(String(userId));
  const url = `${firebaseDbUrl}/site_users/${encodedId}.json`;
  const response = await fetch(url, { method: "GET" });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Firebase lookup failed: ${response.status} ${text || response.statusText}`);
  }

  return response.json();
}

app.get("/health", (_req, res) => {
  res.status(200).json({ ok: true });
});

app.post("/liveblocks-auth", async (req, res) => {
  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const room = typeof body.room === "string" ? body.room.trim() : "";

    const userId =
      (typeof body.userId === "string" && body.userId.trim()) ||
      (typeof req.headers["x-user-id"] === "string" && req.headers["x-user-id"].trim()) ||
      "";

    if (!userId) {
      return res.status(401).json({ error: "Missing userId" });
    }

    const firebaseUser = await loadFirebaseUser(userId);
    if (!firebaseUser || typeof firebaseUser !== "object") {
      return res.status(403).json({ error: "User not found in Firebase" });
    }

    const displayName =
      (typeof firebaseUser.displayName === "string" && firebaseUser.displayName) ||
      (typeof body.name === "string" && body.name) ||
      userId;

    const color =
      (typeof firebaseUser.color === "string" && firebaseUser.color) ||
      (typeof body.color === "string" && body.color) ||
      "#4ECDC4";

    const avatar =
      (typeof firebaseUser.avatar === "string" && firebaseUser.avatar) ||
      (typeof firebaseUser.avatarUrl === "string" && firebaseUser.avatarUrl) ||
      (typeof body.avatar === "string" && body.avatar) ||
      "";

    const session = liveblocks.prepareSession(userId, {
      userInfo: {
        name: displayName,
        color,
        avatar,
      },
    });

    if (room && room.startsWith("course-notes-")) {
      session.allow(room, session.FULL_ACCESS);
    } else {
      session.allow("course-notes-*", session.FULL_ACCESS);
    }

    const { status, body: responseBody } = await session.authorize();
    return res.status(status).send(responseBody);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected auth error";
    return res.status(500).json({ error: message });
  }
});

const port = Number(process.env.PORT || 8787);
app.listen(port, () => {
  console.log(`[liveblocks-auth] Listening on http://localhost:${port}`);
});
