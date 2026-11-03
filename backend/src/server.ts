import { env } from "./config/env.js";
import { connectDB } from "./config/db.js";
import { createApp } from "./app.js";

await connectDB();

// padrão é localhost; no container fica atras do Nginx ou seja a porta da nossa api não fica exposta
createApp().listen(env.PORT, env.HOST, () => {
  console.log(`API rodando em http://${env.HOST}:${env.PORT}`);
});
