const dbName = process.env.MONGO_DB;
const appUser = process.env.MONGO_APP_USER;
const appPassword = process.env.MONGO_APP_PASSWORD;

if (!dbName || !appUser || !appPassword) {
  throw new Error("MONGO_DB, MONGO_APP_USER e MONGO_APP_PASSWORD são obrigatórios");
}

db.getSiblingDB(dbName).createUser({
  user: appUser,
  pwd: appPassword,
  roles: [{ role: "readWrite", db: dbName }],
});

print(`Usuário '${appUser}' criado com readWrite em '${dbName}'`);
