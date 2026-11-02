import { Schema, model, type HydratedDocument, type Types } from "mongoose";
import type { Papel } from "./User.js";

export const RESULTADOS = ["sucesso", "falha", "negado"] as const;
export type Resultado = (typeof RESULTADOS)[number];

export interface AuditLog {
  ator: { id: Types.ObjectId; email: string; papel: Papel } | null;
  acao: string; 
  resultado: Resultado;
  alvo: { tipo: "ticket" | "user"; id: Types.ObjectId } | null;
  ip: string | null;
  detalhes: Record<string, unknown> | null;
  criadoEm: Date;
}

const auditLogSchema = new Schema<AuditLog>(
  {
    ator: {
      type: new Schema(
        {
          id: { type: Schema.Types.ObjectId, ref: "User", required: true },
          email: { type: String, required: true },
          papel: { type: String, required: true },
        },
        { _id: false },
      ),
      default: null,
    },
    acao: { type: String, required: true, maxlength: 50 },
    resultado: { type: String, enum: RESULTADOS, required: true },
    alvo: {
      type: new Schema(
        {
          tipo: { type: String, enum: ["ticket", "user"], required: true },
          id: { type: Schema.Types.ObjectId, required: true },
        },
        { _id: false },
      ),
      default: null,
    },
    ip: { type: String, default: null },
    detalhes: { type: Schema.Types.Mixed, default: null },
  },
  {
    timestamps: { createdAt: "criadoEm", updatedAt: false },
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        delete ret.__v;
        return ret;
      },
    },
  },
);

auditLogSchema.index({ criadoEm: -1 });
auditLogSchema.index({ "ator.id": 1, criadoEm: -1 });
auditLogSchema.index({ "alvo.id": 1, criadoEm: -1 });
auditLogSchema.index({ acao: 1, criadoEm: -1 });

export type AuditLogDocument = HydratedDocument<AuditLog>;
export const AuditLogModel = model<AuditLog>("AuditLog", auditLogSchema);
