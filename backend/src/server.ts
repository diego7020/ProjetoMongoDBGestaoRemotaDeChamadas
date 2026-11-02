import { env } from "./config/env.js";
import { connectDB } from "./config/db.js";
import { createApp } from "./app.js";

await connectDB();

// só localhost; em prod ficaria atrás de um proxy reverso com https
createApp().listen(env.PORT, "127.0.0.1", () => {
  console.log(`API rodando em http://127.0.0.1:${env.PORT}`);
});
