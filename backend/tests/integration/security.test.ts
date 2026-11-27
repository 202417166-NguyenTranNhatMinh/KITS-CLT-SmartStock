import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import request from "supertest";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

import app from "../../src/app";
import { env } from "../../src/config/env";
import { pool } from "../../src/config/db";

describe("Security & RBAC Integration Tests", () => {
  const ts = Date.now();
  const adminEmail = `sec.admin.${ts}@freshmart.local`;
  const staffEmail = `sec.staff.${ts}@freshmart.local`;
  const lockedEmail = `sec.locked.${ts}@freshmart.local`;
  const password = "Password@123";

  let adminToken = "";
  let staffToken = "";
  const createdUserIds: number[] = [];

  before(async () => {
    const hash = await bcrypt.hash(password, 10);

    const adminRes = await pool.query(
      `INSERT INTO users (full_name, email, password_hash, role, is_active)
       VALUES ($1, $2, $3, 'ADMIN', TRUE) RETURNING id`,
      ["Sec Admin", adminEmail, hash]
    );
    createdUserIds.push(adminRes.rows[0].id);

    const staffRes = await pool.query(
      `INSERT INTO users (full_name, email, password_hash, role, is_active)
       VALUES ($1, $2, $3, 'STAFF', TRUE) RETURNING id`,
      ["Sec Staff", staffEmail, hash]
    );
    createdUserIds.push(staffRes.rows[0].id);

    const lockedRes = await pool.query(
      `INSERT INTO users (full_name, email, password_hash, role, is_active)
       VALUES ($1, $2, $3, 'STAFF', FALSE) RETURNING id`,
      ["Sec Locked", lockedEmail, hash]
    );
    createdUserIds.push(lockedRes.rows[0].id);

    const adminLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: adminEmail, password });
    adminToken = adminLogin.body.data.accessToken;

    const staffLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: staffEmail, password });
    staffToken = staffLogin.body.data.accessToken;
  });

  after(async () => {
    if (createdUserIds.length > 0) {
      await pool.query("DELETE FROM users WHERE id = ANY($1::int[])", [createdUserIds]);
    }
    await pool.end();
  });

  describe("401 Unauthorized", () => {
    it("chặn request không có token khi gọi /api/auth/me", async () => {
      const res = await request(app).get("/api/auth/me");
      assert.equal(res.status, 401);
    });

    it("chặn request có token sai định dạng / sai chữ ký", async () => {
      const res = await request(app)
        .get("/api/auth/me")
        .set("Authorization", "Bearer invalid.jwt.token");
      assert.equal(res.status, 401);
    });

    it("chặn request có token đã hết hạn", async () => {
      const expiredToken = jwt.sign(
        { sub: String(createdUserIds[0]), email: adminEmail, role: "ADMIN" },
        env.JWT_SECRET,
        { expiresIn: -10 }
      );

      const res = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${expiredToken}`);
      assert.equal(res.status, 401);
    });

    it("chặn tài khoản bị khóa (isActive = false) đăng nhập", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: lockedEmail, password });
      assert.equal(res.status, 401);
    });
  });

  describe("403 Forbidden (RBAC)", () => {
    it("chặn STAFF gọi GET /api/users (chỉ ADMIN)", async () => {
      const res = await request(app)
        .get("/api/users")
        .set("Authorization", `Bearer ${staffToken}`);
      assert.equal(res.status, 403);
    });

    it("chặn STAFF gọi POST /api/users (chỉ ADMIN)", async () => {
      const res = await request(app)
        .post("/api/users")
        .set("Authorization", `Bearer ${staffToken}`)
        .send({
          fullName: "Hacker",
          email: `hacker.${ts}@freshmart.local`,
          password: "Password@123",
          role: "ADMIN",
        });
      assert.equal(res.status, 403);
    });

    it("cho phép ADMIN gọi GET /api/users", async () => {
      const res = await request(app)
        .get("/api/users")
        .set("Authorization", `Bearer ${adminToken}`);
      assert.equal(res.status, 200);
      assert.equal(Array.isArray(res.body.data), true);
    });
  });
});