// middleware.js

export function adminAuth(req, res, next) {
  const token = req.headers.authorization;

  if (token === "admin-token") {
    next();
  } else {
    return res.status(403).json({
      success: false,
      message: "Unauthorized",
    });
  }
}

export async function checkBlockedUser(db, req, res, next) {
  const { userId } = req.body;

  const blocked = await db.get(
    `SELECT * FROM blocked_users WHERE user_id = ?`,
    [userId],
  );

  if (blocked) {
    return res.status(403).json({
      message: "You are blocked",
    });
  }

  // CRITICAL: await next() so that any async error thrown inside the route
  // handler propagates back here instead of becoming an unhandled rejection
  // which would crash the entire Node.js process.
  try {
    await next();
  } catch (err) {
    console.error("[middleware] Caught error from route handler:", err.message);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: "Internal server error." });
    }
  }
}
