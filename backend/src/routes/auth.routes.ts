import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { UserModel } from "../models/User.js";
import { HASH_FALSO, verificarSenha } from "../auth/password.js";
import { gerarToken } from "../auth/jwt.js";
import { authenticate } from "../middleware/auth.js";
import { HttpError } from "../middleware/errors.js";

export const authRouter = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { erro: "Muitas tentativas de login. Tente novamente mais tarde." },
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
  senha: z.string().min(1).max(128),
});

authRouter.post("/login", loginLimiter, async (req, res) => {
  const { email, senha } = loginSchema.parse(req.body);

  const user = await UserModel.findOne({ email }).select("+senhaHash");
  const senhaOk = await verificarSenha(senha, user?.senhaHash ?? HASH_FALSO);
  if (!user || !senhaOk || !user.ativo) {
    throw new HttpError(401, "Email ou senha inválidos");
  }

  res.json({ token: gerarToken(user.id), usuario: user.toJSON() });
});

authRouter.get("/me", authenticate, (req, res) => {
  res.json(req.user!.toJSON());
});
