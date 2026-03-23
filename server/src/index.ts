import cors from "cors";
import express from "express";
import { env } from "./config/env.js";
import { appRoutes } from "./routes/appRoutes.js";
import { HttpError } from "./utils/http.js";

const app = express();

app.use(
  cors({
    origin: env.CLIENT_URL,
  }),
);
app.use(express.json());
app.use("/api", appRoutes);

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
      error: error.message,
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
