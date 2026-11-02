import type { NextFunction, Request, Response } from "express";
import { isValidObjectId } from "mongoose";
import { verificarToken } from "../auth/jwt.js";
import { UserModel, type Papel } from "../models/User.js";
import { HttpError } from "./errors.js";

// toda requisição tem que passar pelo auth, com base no zero trust lá
export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    throw new HttpError(401, "Não autenticado");
  }

  let userId: string;
  try {
    userId = verificarToken(header.slice("Bearer ".length)).sub;
  } catch {
    throw new HttpError(401, "Token inválido ou expirado");
  }
  if (!isValidObjectId(userId)) {
    throw new HttpError(401, "Token inválido ou expirado");
  }

  const user = await UserModel.findById(userId);
  if (!user || !user.ativo) {
    throw new HttpError(401, "Não autenticado");
  }

  req.user = user;
  next();
}

export function requireRole(...papeis: Papel[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) throw new HttpError(401, "Não autenticado");
    if (!papeis.includes(req.user.papel)) throw new HttpError(403, "Acesso negado");
    next();
  };
}
