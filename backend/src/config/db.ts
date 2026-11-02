import mongoose from "mongoose";

mongoose.set("sanitizeFilter", true);
mongoose.set("strictQuery", true);

export async function connectDB(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI não definida (veja .env.example)");
  }
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
}

export async function disconnectDB(): Promise<void> {
  await mongoose.disconnect();
}
