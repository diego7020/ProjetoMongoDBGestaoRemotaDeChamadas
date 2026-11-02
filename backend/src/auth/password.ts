import bcrypt from "bcryptjs";

const CUSTO = 12;

export function hashSenha(senha: string): Promise<string> {
  return bcrypt.hash(senha, CUSTO);
}

export function verificarSenha(senha: string, hash: string): Promise<boolean> {
  return bcrypt.compare(senha, hash);
}

export const HASH_FALSO = bcrypt.hashSync("senha-inexistente", CUSTO);
