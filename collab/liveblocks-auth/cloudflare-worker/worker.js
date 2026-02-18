const FULL_ACCESS = ["room:write", "comments:write"];

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...extraHeaders,
    },
  });
}

function parseAllowedOrigins(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function resolveCorsHeaders(request, env) {
  const requestOrigin = request.headers.get("Origin") || "";
  const allowedOrigins = parseAllowedOrigins(env.ALLOWED_ORIGINS);

  if (!requestOrigin) {
    return {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type,x-user-id",
    };
  }

  if (allowedOrigins.length === 0 || allowedOrigins.includes(requestOrigin)) {
    return {
      "Access-Control-Allow-Origin": requestOrigin,
      "Access-Control-Allow-Methods": "POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type,x-user-id",
      Vary: "Origin",
    };
  }

  return null;
}

function sanitizeString(value, fallback = "") {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }
  return fallback;
}

async function fetchFirebaseUser(userId, env) {
  const dbUrl = String(env.FIREBASE_DB_URL || "").replace(/\/$/, "");
  if (!dbUrl) {
    throw new Error("Missing FIREBASE_DB_URL");
  }

  const encoded = encodeURIComponent(userId);
  const response = await fetch(`${dbUrl}/site_users/${encoded}.json`, {
    method: "GET",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Firebase lookup failed: ${response.status} ${body || response.statusText}`);
  }

  return response.json();
}

async function authorizeLiveblocks({ userId, room, userInfo, env }) {
  const secret = sanitizeString(env.LIVEBLOCKS_SECRET_KEY);
  if (!secret) {
    throw new Error("Missing LIVEBLOCKS_SECRET_KEY");
  }

  const permissions =
    room && room.startsWith("course-notes-")
      ? { [room]: FULL_ACCESS }
      : { "course-notes-*": FULL_ACCESS };

  const response = await fetch("https://api.liveblocks.io/v2/authorize-user", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      userId,
      permissions,
      userInfo,
    }),
  });

  const bodyText = await response.text();
  return new Response(bodyText, {
    status: response.status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const corsHeaders = resolveCorsHeaders(request, env);

    if (!corsHeaders) {
      return json({ error: "Origin not allowed" }, 403);
    }

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    if (url.pathname === "/health" || url.pathname === "/liveblocks-auth/health") {
      return json({ ok: true }, 200, corsHeaders);
    }

    if (url.pathname !== "/liveblocks-auth" || request.method !== "POST") {
      return json({ error: "Not found" }, 404, corsHeaders);
    }

    try {
      const body = (await request.json().catch(() => ({}))) || {};
      const room = sanitizeString(body.room, "");

      const userId =
        sanitizeString(body.userId) ||
        sanitizeString(request.headers.get("x-user-id"));

      if (!userId) {
        return json({ error: "Missing userId" }, 401, corsHeaders);
      }

      const firebaseUser = await fetchFirebaseUser(userId, env);
      if (!firebaseUser || typeof firebaseUser !== "object") {
        return json({ error: "User not found in Firebase" }, 403, corsHeaders);
      }

      const userInfo = {
        name: sanitizeString(firebaseUser.displayName, sanitizeString(body.name, userId)),
        color: sanitizeString(firebaseUser.color, sanitizeString(body.color, "#4ECDC4")),
        avatar: sanitizeString(
          firebaseUser.avatar,
          sanitizeString(firebaseUser.avatarUrl, sanitizeString(body.avatar, ""))
        ),
      };

      const authResponse = await authorizeLiveblocks({
        userId,
        room,
        userInfo,
        env,
      });

      const headers = new Headers(authResponse.headers);
      Object.entries(corsHeaders).forEach(([key, value]) => headers.set(key, value));
      return new Response(await authResponse.text(), {
        status: authResponse.status,
        headers,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected error";
      return json({ error: message }, 500, corsHeaders);
    }
  },
};
