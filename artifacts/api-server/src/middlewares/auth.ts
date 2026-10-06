import type { Request, Response, NextFunction } from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";

export function jwtSecret(): string {
  const secret = process.env.JWT_SECRET || process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET or SESSION_SECRET must be configured.");
  }
  return secret;
}

export function issueSession(user: Express.Request["user"]): string {
  if (!user) throw new Error("Cannot issue a session without an authenticated user.");
  return jwt.sign(
    {
      sub: user.id,
      name: user.name,
      email: user.email,
      hospitalName: user.hospitalName,
      role: user.role,
    },
    jwtSecret(),
    { algorithm: "HS256", expiresIn: "8h" },
  );
}

export function setSessionCookie(res: Response, token: string): void {
  res.cookie("hms_session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 8 * 60 * 60 * 1000,
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie("hms_session", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
}

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const cookieToken = req.cookies?.hms_session;
  const authorization = req.get("authorization");
  const bearerToken = authorization?.startsWith("Bearer ")
    ? authorization.slice(7)
    : undefined;
  const token = cookieToken || bearerToken;
  if (!token) {
    res.status(401).json({ error: "Sign in to continue." });
    return;
  }

  try {
    const payload = jwt.verify(token, jwtSecret(), {
      algorithms: ["HS256"],
    }) as JwtPayload;
    if (
      typeof payload.sub !== "string" ||
      typeof payload.name !== "string" ||
      typeof payload.email !== "string" ||
      typeof payload.hospitalName !== "string" ||
      !["ADMIN", "HOSPITAL_MANAGER", "STAFF"].includes(String(payload.role))
    ) {
      res.status(401).json({ error: "Your session is invalid. Please sign in again." });
      return;
    }
    req.user = {
      id: payload.sub,
      name: payload.name,
      email: payload.email,
      hospitalName: payload.hospitalName,
      role: payload.role as "ADMIN" | "HOSPITAL_MANAGER" | "STAFF",
    };
    next();
  } catch {
    res.status(401).json({ error: "Your session has expired. Please sign in again." });
  }
}

export function requireManager(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!req.user || !["ADMIN", "HOSPITAL_MANAGER"].includes(req.user.role)) {
    res.status(403).json({ error: "A hospital manager must perform this action." });
    return;
  }
  next();
}

export function currentUser(req: Request): NonNullable<Request["user"]> {
  if (!req.user) throw new Error("Authentication middleware did not provide a user.");
  return req.user;
}
