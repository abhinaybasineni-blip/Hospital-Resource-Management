import { Router, type IRouter } from "express";
import rateLimit from "express-rate-limit";
import bcrypt from "bcryptjs";
import {
  ChangePasswordBody,
  GetCurrentUserResponse,
  GetProfileResponse,
  LoginBody,
  LoginResponse,
  RegisterBody,
  RegisterResponse,
  UpdateProfileBody,
  UpdateProfileResponse,
} from "@workspace/api-zod";
import { pool } from "../database";
import {
  clearSessionCookie,
  currentUser,
  issueSession,
  requireAuth,
  setSessionCookie,
} from "../middlewares/auth";

const router: IRouter = Router();
const authLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 8,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many sign-in attempts. Wait a few minutes and try again." },
});

function publicUser(row: Record<string, unknown>) {
  const createdAt = row.created_at instanceof Date
    ? row.created_at.toISOString()
    : new Date(String(row.created_at)).toISOString();
  return {
    id: String(row.id),
    name: String(row.name),
    email: String(row.email),
    hospitalName: String(row.hospital_name),
    role: row.role as "ADMIN" | "HOSPITAL_MANAGER" | "STAFF",
    phone: row.phone == null ? null : String(row.phone),
    avatarUrl: row.avatar_url == null ? null : String(row.avatar_url),
    createdAt,
  };
}

router.post("/auth/register", authLimiter, async (req, res) => {
  const input = RegisterBody.parse(req.body);
  const email = input.email.trim().toLowerCase();
  const passwordHash = await bcrypt.hash(input.password, 12);
  try {
    const result = await pool.query(
      `insert into public.profiles (name, email, password_hash, hospital_name)
       values ($1, $2, $3, $4)
       returning id, name, email, hospital_name, role, phone, avatar_url, created_at`,
      [input.name.trim(), email, passwordHash, input.hospitalName.trim()],
    );
    const user = publicUser(result.rows[0]);
    setSessionCookie(res, issueSession(user));
    res.status(201).json(RegisterResponse.parse({ user }));
  } catch (error) {
    if ((error as { code?: string }).code === "23505") {
      res.status(409).json({ error: "An account with this email already exists." });
      return;
    }
    throw error;
  }
});

router.post("/auth/login", authLimiter, async (req, res) => {
  const input = LoginBody.parse(req.body);
  const result = await pool.query(
    `select id, name, email, password_hash, hospital_name, role, phone, avatar_url, created_at
     from public.profiles where lower(email) = $1 limit 1`,
    [input.email.trim().toLowerCase()],
  );
  const row = result.rows[0] as Record<string, unknown> | undefined;
  const passwordMatches =
    row && (await bcrypt.compare(input.password, String(row.password_hash)));
  if (!row || !passwordMatches) {
    res.status(401).json({ error: "Email or password is incorrect." });
    return;
  }
  const user = publicUser(row);
  setSessionCookie(res, issueSession(user));
  res.json(LoginResponse.parse({ user }));
});

router.post("/auth/logout", (_req, res) => {
  clearSessionCookie(res);
  res.status(204).send();
});

router.get("/auth/me", requireAuth, async (req, res) => {
  const user = currentUser(req);
  const result = await pool.query(
    `select id, name, email, hospital_name, role, phone, avatar_url, created_at
     from public.profiles where id = $1`,
    [user.id],
  );
  if (!result.rows[0]) {
    clearSessionCookie(res);
    res.status(401).json({ error: "This account is no longer available. Please sign in again." });
    return;
  }
  res.json(GetCurrentUserResponse.parse(publicUser(result.rows[0])));
});

router.get("/profile", requireAuth, async (req, res) => {
  const user = currentUser(req);
  const result = await pool.query(
    `select id, name, email, hospital_name, role, phone, avatar_url, created_at
     from public.profiles where id = $1`,
    [user.id],
  );
  if (!result.rows[0]) {
    res.status(404).json({ error: "Profile not found." });
    return;
  }
  res.json(GetProfileResponse.parse(publicUser(result.rows[0])));
});

router.put("/profile", requireAuth, async (req, res) => {
  const user = currentUser(req);
  const input = UpdateProfileBody.parse(req.body);
  const columnByField: Record<string, string> = {
    name: "name",
    hospitalName: "hospital_name",
    phone: "phone",
    avatarUrl: "avatar_url",
  };
  const assignments: string[] = [];
  const values: unknown[] = [];
  for (const [field, column] of Object.entries(columnByField)) {
    const value = input[field as keyof typeof input];
    if (value !== undefined) {
      values.push(typeof value === "string" ? value.trim() : value);
      assignments.push(`${column} = $${values.length}`);
    }
  }
  if (!assignments.length) {
    res.status(400).json({ error: "Provide at least one profile field to update." });
    return;
  }
  assignments.push("updated_at = now()");
  values.push(user.id);
  const result = await pool.query(
    `update public.profiles set ${assignments.join(", ")}
     where id = $${values.length}
     returning id, name, email, hospital_name, role, phone, avatar_url, created_at`,
    values,
  );
  if (!result.rows[0]) {
    res.status(404).json({ error: "Profile not found." });
    return;
  }
  const updatedUser = publicUser(result.rows[0]);
  setSessionCookie(res, issueSession(updatedUser));
  res.json(UpdateProfileResponse.parse(updatedUser));
});

router.post("/profile/password", requireAuth, authLimiter, async (req, res) => {
  const user = currentUser(req);
  const input = ChangePasswordBody.parse(req.body);
  const result = await pool.query(
    "select password_hash from public.profiles where id = $1",
    [user.id],
  );
  const row = result.rows[0] as { password_hash: string } | undefined;
  if (!row || !(await bcrypt.compare(input.currentPassword, row.password_hash))) {
    res.status(401).json({ error: "Current password is incorrect." });
    return;
  }
  const passwordHash = await bcrypt.hash(input.newPassword, 12);
  await pool.query(
    "update public.profiles set password_hash = $1, updated_at = now() where id = $2",
    [passwordHash, user.id],
  );
  res.status(204).send();
});

export default router;
