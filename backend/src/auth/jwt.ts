import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../config/env.js";

export interface TokenPayload {
  sub: string;
}

export function gerarToken(userId: string): string {
  return jwt.sign({}, env.JWT_SECRET, {
    subject: userId,
    algorithm: "HS256",
    expiresIn: env.JWT_EXPIRES_IN as SignOptions["expiresIn"],
  });
}

export function verificarToken(token: string): TokenPayload {
  // algorithms fixo: impede ataques que trocam o algoritmo do token (ex.: "none")
  const payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ["HS256"] });
  if (typeof payload === "string" || !payload.sub) {
    throw new Error("Token inválido");
  }
  return { sub: payload.sub };
}
