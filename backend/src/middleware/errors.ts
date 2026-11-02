import type { NextFunction, Request, Response } from "express";
import { z } from "zod";
import mongoose from "mongoose";
import { registrar } from "../audit/registrar.js";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function notFound(_req: Request, _res: Response, next: NextFunction) {
  next(new HttpError(404, "Rota não encontrada"));
}

export async function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    // tentativa sem autenticação (401) ou sem permissão (403) vai para a auditoria.
    if ((err.status === 401 || err.status === 403) && !req.originalUrl.startsWith("/auth/login")) {
      await registrar(req, {
        acao: "acesso.negado",
        resultado: "negado",
        detalhes: { metodo: req.method, rota: req.originalUrl, status: err.status, motivo: err.message },
      });
    }
    return res.status(err.status).json({ erro: err.message });
  }
  if (err instanceof z.ZodError) {
    return res.status(400).json({ erro: "Dados inválidos", detalhes: z.flattenError(err) });
  }
  if (err instanceof mongoose.Error.ValidationError || err instanceof mongoose.Error.CastError) {
    return res.status(400).json({ erro: "Dados inválidos" });
  }
  if (typeof err === "object" && err !== null && (err as { code?: number }).code === 11000) {
    return res.status(409).json({ erro: "Registro já existe" });
  }
  // JSON malformado no corpo da requisição
  if (typeof err === "object" && err !== null && (err as { type?: string }).type === "entity.parse.failed") {
    return res.status(400).json({ erro: "JSON inválido" });
  }
  if (typeof err === "object" && err !== null && (err as { type?: string }).type === "entity.too.large") {
    return res.status(413).json({ erro: "Requisição muito grande" });
  }

  console.error(err);
  return res.status(500).json({ erro: "Erro interno" });
}
