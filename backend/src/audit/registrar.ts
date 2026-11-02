import type { Request } from "express";
import type { Types } from "mongoose";
import { AuditLogModel, type Resultado } from "../models/AuditLog.js";
import type { UserDocument } from "../models/User.js";

interface Evento {
  acao: string;
  resultado: Resultado;
  alvo?: { tipo: "ticket" | "user"; id: Types.ObjectId | string };
  detalhes?: Record<string, unknown>;
  ator?: UserDocument | null;
}

export async function registrar(req: Request, evento: Evento): Promise<void> {
  const ator = evento.ator === undefined ? req.user : evento.ator;
  try {
    await AuditLogModel.create({
      ator: ator ? { id: ator._id, email: ator.email, papel: ator.papel } : null,
      acao: evento.acao,
      resultado: evento.resultado,
      alvo: evento.alvo ?? null,
      ip: req.ip ?? null,
      detalhes: evento.detalhes ?? null,
    });
  } catch (e) {
    console.error("Falha ao gravar auditoria:", evento.acao, e);
  }
}

export function diferencas<T extends object>(
  antes: T,
  depois: T,
  campos: (keyof T & string)[],
): Record<string, { de: unknown; para: unknown }> {
  const mudou: Record<string, { de: unknown; para: unknown }> = {};
  for (const campo of campos) {
    const de = antes[campo] ?? null;
    const para = depois[campo] ?? null;
    if (String(de) !== String(para)) mudou[campo] = { de, para };
  }
  return mudou;
}
