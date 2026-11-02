import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { UserModel } from "../models/User.js";
import { HASH_FALSO, verificarSenha } from "../auth/password.js";
import { gerarToken } from "../auth/jwt.js";
import { authenticate } from "../middleware/auth.js";
import { HttpError } from "../middleware/errors.js";
import { registrar } from "../audit/registrar.js";

export const authRouter = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: async (req, res) => {
    await registrar(req, { acao: "auth.login_bloqueado", resultado: "negado", ator: null });
    res.status(429).json({ erro: "Muitas tentativas de login. Tente novamente mais tarde." });
  },
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
    const motivo = !user ? "usuario_inexistente" : !senhaOk ? "senha_incorreta" : "conta_inativa";
    await registrar(req, {
      acao: "auth.login_falhou",
      resultado: "falha",
      ator: null,
      alvo: user ? { tipo: "user", id: user._id } : undefined,
      detalhes: { email, motivo },
    });
    throw new HttpError(401, "Email ou senha inválidos");
  }

  await registrar(req, { acao: "auth.login", resultado: "sucesso", ator: user });
  res.json({ token: gerarToken(user.id), usuario: user.toJSON() });
});

authRouter.get("/me", authenticate, (req, res) => {
  res.json(req.user!.toJSON());
});
