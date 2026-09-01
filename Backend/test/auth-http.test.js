const assert = require("node:assert/strict");
const test = require("node:test");
const request = require("supertest");

const { createApp } = require("../src/app");
const {
  createSessionToken,
  verifySessionToken,
} = require("../src/auth/session");

const config = {
  NODE_ENV: "test",
  APP_ORIGIN: "http://localhost:5173",
  MVP_ACCESS_CODE: "correct-access-code",
  COOKIE_SIGNING_SECRET: "01234567890123456789012345678901",
  AUTH_COOKIE_NAME: "product_finder_session",
  AUTH_TTL_SECONDS: 3600,
  WS_MAX_PAYLOAD_BYTES: 32768,
};

test("signed session tokens reject tampering and expiration", () => {
  const token = createSessionToken({
    secret: config.COOKIE_SIGNING_SECRET,
    ttlSeconds: 10,
    now: 0,
  });
  assert.ok(
    verifySessionToken(token, {
      secret: config.COOKIE_SIGNING_SECRET,
      now: 9_000,
    }),
  );
  assert.equal(
    verifySessionToken(`${token}x`, { secret: config.COOKIE_SIGNING_SECRET }),
    null,
  );
  assert.equal(
    verifySessionToken(token, {
      secret: config.COOKIE_SIGNING_SECRET,
      now: 10_000,
    }),
    null,
  );
});

test("health routes distinguish liveness and readiness", async () => {
  const app = createApp({
    config,
    readiness: () => ({ ready: false, status: "not_ready" }),
  });

  await request(app).get("/api/health/live").expect(200, { status: "ok" });
  await request(app)
    .get("/api/health/ready")
    .expect(503, { ready: false, status: "not_ready" });
});

test("production trusts only the loopback reverse proxy", () => {
  const app = createApp({
    config: { ...config, NODE_ENV: "production" },
    readiness: () => ({ ready: true, status: "ready" }),
  });

  assert.equal(app.get("trust proxy"), "loopback");
});

test("access-code login requires exact origin and creates an authenticated session", async () => {
  let loggedOutSession = null;
  const app = createApp({
    config,
    readiness: () => ({ ready: true, status: "ready" }),
    onSessionLogout(session) {
      loggedOutSession = session;
    },
  });
  const agent = request.agent(app);

  await agent
    .post("/api/auth/login")
    .set("Origin", "https://attacker.example")
    .send({ accessCode: config.MVP_ACCESS_CODE })
    .expect(403);

  await agent
    .post("/api/auth/login")
    .set("Origin", config.APP_ORIGIN)
    .send({ accessCode: "wrong-code" })
    .expect(401, { error: "Authentication failed" });

  const login = await agent
    .post("/api/auth/login")
    .set("Origin", config.APP_ORIGIN)
    .send({ accessCode: config.MVP_ACCESS_CODE })
    .expect(204);

  assert.match(login.headers["set-cookie"][0], /HttpOnly/);
  assert.match(login.headers["set-cookie"][0], /SameSite=Strict/);
  await agent.get("/api/auth/session").expect(200, { authenticated: true });

  await agent
    .post("/api/auth/logout")
    .set("Origin", config.APP_ORIGIN)
    .expect(204);
  assert.equal(typeof loggedOutSession?.nonce, "string");
  await agent.get("/api/auth/session").expect(401, { authenticated: false });
});
