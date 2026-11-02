import { Schema, model, type HydratedDocument, type Types } from "mongoose";

export const STATUS = ["aberto", "em_andamento", "resolvido", "fechado"] as const;
export type Status = (typeof STATUS)[number];

export const PRIORIDADES = ["baixa", "media", "alta", "critica"] as const;
export type Prioridade = (typeof PRIORIDADES)[number];

export interface Ticket {
  titulo: string;
  descricao: string;
  status: Status;
  prioridade: Prioridade;
  solicitante: Types.ObjectId;
  tecnicoResponsavel: Types.ObjectId | null;
  fechadoEm: Date | null;
  arquivado: boolean;
  arquivadoEm: Date | null;
  arquivadoPor: Types.ObjectId | null;
  criadoEm: Date;
  atualizadoEm: Date;
}

const ticketSchema = new Schema<Ticket>(
  {
    titulo: { type: String, required: true, trim: true, minlength: 3, maxlength: 120 },
    descricao: { type: String, required: true, trim: true, minlength: 1, maxlength: 5000 },
    status: { type: String, enum: STATUS, default: "aberto", required: true },
    prioridade: { type: String, enum: PRIORIDADES, default: "media", required: true },
    solicitante: { type: Schema.Types.ObjectId, ref: "User", required: true, immutable: true },
    tecnicoResponsavel: { type: Schema.Types.ObjectId, ref: "User", default: null },
    fechadoEm: { type: Date, default: null },
    arquivado: { type: Boolean, default: false },
    arquivadoEm: { type: Date, default: null },
    arquivadoPor: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  {
    timestamps: { createdAt: "criadoEm", updatedAt: "atualizadoEm" },
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        delete ret.__v;
        return ret;
      },
    },
  },
);

ticketSchema.index({ solicitante: 1, criadoEm: -1 });
ticketSchema.index({ tecnicoResponsavel: 1, status: 1 });
ticketSchema.index({ arquivado: 1, status: 1, prioridade: 1 });

ticketSchema.pre("save", function () {
  if (this.isModified("status")) {
    this.fechadoEm = this.status === "fechado" ? new Date() : null;
  }
});

export type TicketDocument = HydratedDocument<Ticket>;
export const TicketModel = model<Ticket>("Ticket", ticketSchema);
