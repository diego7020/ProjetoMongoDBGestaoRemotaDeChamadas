import { Router } from "express";
import { z } from "zod";
import mongoose, { isValidObjectId, type QueryFilter } from "mongoose";
import { AuditLogModel, RESULTADOS, type AuditLog } from "../models/AuditLog.js";
import { authenticate, requireRole } from "../middleware/auth.js";

export const auditRouter = Router();
auditRouter.use(authenticate, requireRole("admin"));

const objectId = z.string().refine(isValidObjectId, "id inválido");

const listarSchema = z
  .object({
    acao: z.string().regex(/^[a-z_.]{1,50}$/).optional(),
    resultado: z.enum(RESULTADOS).optional(),
    atorId: objectId.optional(),
    alvoId: objectId.optional(),
    de: z.coerce.date().optional(),
    ate: z.coerce.date().optional(),
    pagina: z.coerce.number().int().min(1).default(1),
    limite: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict();

auditRouter.get("/", async (req, res) => {
  const q = listarSchema.parse(req.query);

  const filtro: QueryFilter<AuditLog> = {};
  if (q.acao) filtro.acao = q.acao;
  if (q.resultado) filtro.resultado = q.resultado;
  if (q.atorId) filtro["ator.id"] = q.atorId;
  if (q.alvoId) filtro["alvo.id"] = q.alvoId;
  if (q.de || q.ate) {
    filtro.criadoEm = mongoose.trusted({ ...(q.de && { $gte: q.de }), ...(q.ate && { $lte: q.ate }) });
  }

  const [itens, total] = await Promise.all([
    AuditLogModel.find(filtro)
      .sort({ criadoEm: -1 })
      .skip((q.pagina - 1) * q.limite)
      .limit(q.limite),
    AuditLogModel.countDocuments(filtro),
  ]);
  res.json({ itens, total, pagina: q.pagina, limite: q.limite });
});
