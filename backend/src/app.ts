import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { env } from "./config/env.js";
import { authRouter } from "./routes/auth.routes.js";
import { usersRouter } from "./routes/users.routes.js";
import { errorHandler, notFound } from "./middleware/errors.js";
import { ticketsRouter } from "./routes/tickets.routes.js";
import { auditRouter } from "./routes/audit.routes.js";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN })); // nada alem do front consegue chamar a api
  app.use(express.json({ limit: "10kb" })); // limitar o payload né
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 300,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message: { erro: "Muitas requisições. Tente novamente mais tarde." },
    }),
  );

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });
  app.use("/auth", authRouter);
  app.use("/users", usersRouter);
  app.use("/tickets", ticketsRouter);
  app.use("/audit", auditRouter);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
