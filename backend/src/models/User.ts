import { Schema, model, type HydratedDocument } from "mongoose";

export const PAPEIS = ["usuario", "tecnico", "admin"] as const;
export type Papel = (typeof PAPEIS)[number];

export interface User {
  nome: string;
  email: string;
  senhaHash: string;
  papel: Papel;
  ativo: boolean;
  criadoEm: Date;
  atualizadoEm: Date;
}

const userSchema = new Schema<User>(
  {
    nome: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      maxlength: 254,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    },
    senhaHash: { type: String, required: true, select: false },
    papel: { type: String, enum: PAPEIS, default: "usuario", required: true },
    ativo: { type: Boolean, default: true },
  },
  {
    timestamps: { createdAt: "criadoEm", updatedAt: "atualizadoEm" },
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        delete ret.senhaHash;
        delete ret.__v;
        return ret;
      },
    },
  },
);

export type UserDocument = HydratedDocument<User>;
export const UserModel = model<User>("User", userSchema);
