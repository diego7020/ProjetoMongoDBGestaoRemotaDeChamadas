import { Router } from "express";
import { z } from "zod";
import { isValidObjectId } from "mongoose";
import { PAPEIS, UserModel } from "../models/User.js";
import { hashSenha } from "../auth/password.js";
import { authenticate, requireRole } from "../middleware/auth.js";
import { HttpError } from "../middleware/errors.js";

export const usersRouter = Router();
usersRouter.use(authenticate, requireRole("admin"));

const senhaSchema = z
  .string()
  .min(10, "Senha deve ter pelo menos 10 caracteres")
  .max(128)
  .regex(/[a-z]/, "Precisa de letra minúscula")
  .regex(/[A-Z]/, "Precisa de letra maiúscula")
  .regex(/[0-9]/, "Precisa de número");

const criarSchema = z
  .object({
    nome: z.string().trim().min(2).max(100),
    email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
    senha: senhaSchema,
    papel: z.enum(PAPEIS).default("usuario"),
  })
  .strict();

const atualizarSchema = z
  .object({
    nome: z.string().trim().min(2).max(100).optional(),
    papel: z.enum(PAPEIS).optional(),
    ativo: z.boolean().optional(),
    senha: senhaSchema.optional(),
  })
  .strict();

usersRouter.get("/", async (_req, res) => {
  const users = await UserModel.find().sort({ nome: 1 });
  res.json(users);
});

usersRouter.post("/", async (req, res) => {
  const { senha, ...dados } = criarSchema.parse(req.body);
  const user = await UserModel.create({ ...dados, senhaHash: await hashSenha(senha) });
  res.status(201).json(user);
});

usersRouter.patch("/:id", async (req, res) => {
  const id = req.params.id;
  if (!isValidObjectId(id)) throw new HttpError(404, "Usuário não encontrado");
  const { senha, ...dados } = atualizarSchema.parse(req.body);

  if (id === req.user!.id && ((dados.papel !== undefined && dados.papel !== "admin") || dados.ativo === false)) {
    throw new HttpError(400, "Você não pode remover seu próprio acesso de admin");
  }

  const user = await UserModel.findById(id);
  if (!user) throw new HttpError(404, "Usuário não encontrado");
  user.set(dados);
  if (senha) user.senhaHash = await hashSenha(senha);
  await user.save();
  res.json(user);
});
