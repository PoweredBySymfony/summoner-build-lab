import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { env } from "./config/env.js";
import { adminRoutes } from "./routes/adminRoutes.js";
import { appRoutes } from "./routes/appRoutes.js";
import { HttpError } from "./utils/http.js";

const app = express();
app.set("trust proxy", 1);

if (process.env.NODE_ENV !== "production" && !process.env.AUTH_SECRET) {
  console.warn("[auth] AUTH_SECRET is missing in .env, using development fallback secret.");
}

app.use(
  cors({
    origin: env.CLIENT_URL,
    credentials: true,
  }),
);
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
}));
app.use(cookieParser());
app.use(express.json({ limit: "1mb" }));
app.use((request, _response, next) => {
  console.log(`[api] ${request.method} ${request.originalUrl}`);
  next();
});
app.use("/api", appRoutes);
app.use("/api", adminRoutes);

app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  if (error instanceof HttpError) {
    response.status(error.status).json({
      error: error.message,
      details: error.details,
    });
    return;
  }

  if (error instanceof Error) {
    response.status(500).json({
      error: process.env.NODE_ENV === "production" ? "Unexpected server error." : error.message,
    });
    return;
  }

  response.status(500).json({
    error: "Unexpected server error.",
  });
});

app.listen(env.PORT, () => {
  console.log(`API listening on port ${env.PORT}`);
});
