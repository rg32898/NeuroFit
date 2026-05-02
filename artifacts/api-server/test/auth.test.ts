import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks (hoisted before any imports) ──────────────────────────────────────

vi.mock("@workspace/db", () => ({
  db: {},
  usersTable: {},
  profilesTable: {},
}));

vi.mock("../src/auth/userRepo", () => ({
  findUserByEmail: vi.fn(),
  createUser: vi.fn(),
  findUserById: vi.fn(),
  incrementTokenVersion: vi.fn(),
}));

// ── Imports ──────────────────────────────────────────────────────────────────

import request from "supertest";
import app from "../src/app";
import * as userRepo from "../src/auth/userRepo";
import { hashPassword } from "../src/auth/passwords";
import jwt from "jsonwebtoken";
import { config } from "../src/config";

// ── In-memory store ───────────────────────────────────────────────────────────

type StoredUser = {
  id: string;
  email: string;
  passwordHash: string | null;
  appleSub: string | null;
  googleSub: string | null;
  tokenVersion: number;
  createdAt: Date;
  deletedAt: Date | null;
};

let store: Map<string, StoredUser>;

beforeEach(() => {
  store = new Map();

  vi.mocked(userRepo.findUserByEmail).mockImplementation(async (email) => {
    return [...store.values()].find((u) => u.email === email) ?? null;
  });

  vi.mocked(userRepo.createUser).mockImplementation(async (data) => {
    const user: StoredUser = {
      ...data,
      appleSub: null,
      googleSub: null,
      tokenVersion: 0,
      createdAt: new Date(),
      deletedAt: null,
    };
    store.set(user.id, user);
    return user;
  });

  vi.mocked(userRepo.findUserById).mockImplementation(async (id) => {
    const user = store.get(id);
    return user ? { user, profile: null } : null;
  });

  vi.mocked(userRepo.incrementTokenVersion).mockImplementation(async (id) => {
    const user = store.get(id);
    if (user) {
      user.tokenVersion += 1;
      return user.tokenVersion;
    }
    return 1;
  });
});

// ── Helper ────────────────────────────────────────────────────────────────────

async function registerAndLogin(
  email = "test@neurofit.app",
  password = "password123",
) {
  const reg = await request(app)
    .post("/api/auth/register")
    .send({ email, password });
  expect(reg.status).toBe(201);
  return reg.body as {
    user: { id: string; email: string };
    accessToken: string;
    refreshToken: string;
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("POST /api/auth/register", () => {
  it("creates a user and returns tokens", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "alice@neurofit.app", password: "securepass1" });

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe("alice@neurofit.app");
    expect(typeof res.body.accessToken).toBe("string");
    expect(typeof res.body.refreshToken).toBe("string");
  });

  it("returns 409 for duplicate email", async () => {
    await registerAndLogin("dup@neurofit.app");

    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "dup@neurofit.app", password: "anotherpass" });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("EMAIL_TAKEN");
  });

  it("returns 400 for invalid email", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "not-an-email", password: "password123" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("POST /api/auth/login", () => {
  it("returns tokens for valid credentials", async () => {
    const hash = await hashPassword("mypassword");
    const id = crypto.randomUUID();
    store.set(id, {
      id,
      email: "bob@neurofit.app",
      passwordHash: hash,
      appleSub: null,
      googleSub: null,
      tokenVersion: 0,
      createdAt: new Date(),
      deletedAt: null,
    });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "bob@neurofit.app", password: "mypassword" });

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe("bob@neurofit.app");
    expect(typeof res.body.accessToken).toBe("string");
  });

  it("returns 401 for wrong password", async () => {
    const hash = await hashPassword("correctpassword");
    const id = crypto.randomUUID();
    store.set(id, {
      id,
      email: "carol@neurofit.app",
      passwordHash: hash,
      appleSub: null,
      googleSub: null,
      tokenVersion: 0,
      createdAt: new Date(),
      deletedAt: null,
    });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "carol@neurofit.app", password: "wrongpassword" });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("returns 401 for unknown email", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "ghost@neurofit.app", password: "password123" });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
  });
});

describe("register → login → refresh → me happy path", () => {
  it("completes the full auth flow", async () => {
    // Register
    const { user, accessToken, refreshToken } = await registerAndLogin(
      "flow@neurofit.app",
      "flowpassword1",
    );
    expect(user.email).toBe("flow@neurofit.app");

    // GET /me with access token
    const meRes = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(meRes.status).toBe(200);
    expect(meRes.body.user.id).toBe(user.id);

    // Refresh tokens
    const refreshRes = await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken });
    expect(refreshRes.status).toBe(200);
    expect(typeof refreshRes.body.accessToken).toBe("string");

    // Use new access token
    const me2 = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${refreshRes.body.accessToken}`);
    expect(me2.status).toBe(200);
    expect(me2.body.user.id).toBe(user.id);
  });
});

describe("POST /api/auth/refresh", () => {
  it("rejects a refresh token after logout", async () => {
    const { accessToken, refreshToken } = await registerAndLogin(
      "logout@neurofit.app",
    );

    // Logout — increments tokenVersion
    const logoutRes = await request(app)
      .post("/api/auth/logout")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(logoutRes.status).toBe(204);

    // Old refresh token should now be rejected
    const refreshRes = await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken });
    expect(refreshRes.status).toBe(401);
    expect(refreshRes.body.error.code).toBe("TOKEN_REVOKED");
  });
});

describe("GET /api/auth/me", () => {
  it("returns 401 for expired access token", async () => {
    const { user } = await registerAndLogin("expired@neurofit.app");

    const expiredToken = jwt.sign(
      { sub: user.id },
      config.JWT_ACCESS_SECRET,
      { expiresIn: -1 },
    );

    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${expiredToken}`);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("TOKEN_EXPIRED");
  });

  it("returns 401 with no Authorization header", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });
});

describe("POST /api/auth/apple & /google", () => {
  it("apple returns 501", async () => {
    const res = await request(app)
      .post("/api/auth/apple")
      .send({ idToken: "stub" });
    expect(res.status).toBe(501);
  });

  it("google returns 501", async () => {
    const res = await request(app)
      .post("/api/auth/google")
      .send({ idToken: "stub" });
    expect(res.status).toBe(501);
  });
});
