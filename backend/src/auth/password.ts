import bcrypt from "bcryptjs";
import { z } from "zod";

const CUSTO = 12;

export function hashSenha(senha: string): Promise<string> {
  return bcrypt.hash(senha, CUSTO);
}

export function verificarSenha(senha: string, hash: string): Promise<boolean> {
  return bcrypt.compare(senha, hash);
}

export const HASH_FALSO = bcrypt.hashSync("senha-inexistente", CUSTO);

export const senhaSchema = z
  .string()
  .min(10, "Senha deve ter pelo menos 10 caracteres")
  .max(128)
  .regex(/[a-z]/, "Precisa de letra minúscula")
  .regex(/[A-Z]/, "Precisa de letra maiúscula")
  .regex(/[0-9]/, "Precisa de número");
