import compression from "compression";
import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";
import pinoHttp from "pino-http";

import { config } from "./config";
import { logger } from "./lib/logger";
import { errorHandler } from "./middlewares/error";
import { requestId } from "./middlewares/requestId";
import router from "./routes";

const app: Express = express();

// Security
app.use(helmet());

// CORS — restricted to configured origin(s)
app.use(
  cors({
    origin:
      config.CORS_ORIGIN === "*"
        ? "*"
        : config.CORS_ORIGIN.split(",").map((o) => o.trim()),
    credentials: true,
  }),
);

// Compression
app.use(compression());

// Request ID — must come before pino-http so the id is available in logs
app.use(requestId);

// Structured HTTP logging — Authorization headers are redacted for security
app.use(
  pinoHttp({
    logger,
    genReqId: (req) => (req as express.Request & { id?: string }).id,
    redact: {
      paths: ["req.headers.authorization"],
      censor: "[REDACTED]",
    },
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);

// Body parsing
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// Routes
app.use("/api", router);

// Central error handler — must be last
app.use(errorHandler);

export default app;
