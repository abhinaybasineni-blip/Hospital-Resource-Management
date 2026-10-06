import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(helmet());
app.use(
  cors({
    origin: process.env.CLIENT_URL || false,
    credentials: true,
  }),
);
app.use(
  rateLimit({
    windowMs: 60_000,
    limit: 180,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: "Too many requests. Please try again shortly." },
  }),
);
app.use(cookieParser());
app.use(express.json({ limit: "256kb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/api", (req, res, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method) || !req.cookies?.hms_session) {
    next();
    return;
  }
  const origin = req.get("origin");
  if (!origin) {
    next();
    return;
  }
  try {
    const originUrl = new URL(origin);
    const configuredOrigin = process.env.CLIENT_URL
      ? new URL(process.env.CLIENT_URL).origin
      : undefined;
    if (originUrl.origin !== configuredOrigin && originUrl.host !== req.get("host")) {
      res.status(403).json({ error: "This request origin is not allowed." });
      return;
    }
  } catch {
    res.status(403).json({ error: "This request origin is not allowed." });
    return;
  }
  next();
});

app.use("/api", router);

app.use((error: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const candidate = error as { code?: string; message?: string; name?: string; status?: number };
  if (candidate.status && candidate.status >= 400 && candidate.status < 600) {
    res.status(candidate.status).json({
      error: candidate.message || "This service is temporarily unavailable.",
    });
    return;
  }
  if (candidate.name === "ZodError" || candidate.name === "ResourceValidationError") {
    const issues = (error as { issues?: Array<{ message?: string }> }).issues;
    const issueMessage = issues?.map((issue) => issue.message).filter(Boolean).join(" ");
    res.status(400).json({
      error: issueMessage || candidate.message || "The submitted information is invalid.",
    });
    return;
  }
  if (candidate.code === "23505") {
    res.status(409).json({ error: "That record already exists." });
    return;
  }
  if (candidate.code === "23514" || candidate.code === "22P02") {
    res.status(400).json({ error: "The submitted information is invalid." });
    return;
  }
  req.log.error({ err: error }, "Unhandled API error");
  res.status(500).json({ error: "Something went wrong. Please try again." });
});

export default app;
