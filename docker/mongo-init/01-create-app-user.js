const dbName = process.env.MONGO_DB;
const appUser = process.env.MONGO_APP_USER;
const appPassword = process.env.MONGO_APP_PASSWORD;

if (!dbName || !appUser || !appPassword) {
  throw new Error("MONGO_DB, MONGO_APP_USER e MONGO_APP_PASSWORD são obrigatórios");
}

const appDb = db.getSiblingDB(dbName);
const ROLE = "chamadosApp";

const crud = ["find", "insert", "update", "remove", "createCollection", "createIndex", "dropIndex", "listIndexes", "killCursors"];
const somenteAnexar = ["find", "insert", "createCollection", "createIndex", "listIndexes", "killCursors"];

const privileges = [
  { resource: { db: dbName, collection: "users" }, actions: crud },
  { resource: { db: dbName, collection: "tickets" }, actions: crud },
  { resource: { db: dbName, collection: "auditlogs" }, actions: somenteAnexar },
  { resource: { db: dbName, collection: "" }, actions: ["listCollections"] },
];

if (appDb.getRole(ROLE)) {
  appDb.updateRole(ROLE, { privileges, roles: [] });
  print(`Role '${ROLE}' atualizada`);
} else {
  appDb.createRole({ role: ROLE, privileges, roles: [] });
  print(`Role '${ROLE}' criada`);
}

if (appDb.getUser(appUser)) {
  appDb.updateUser(appUser, { roles: [{ role: ROLE, db: dbName }] });
  print(`Usuário '${appUser}' atualizado para a role '${ROLE}'`);
} else {
  appDb.createUser({ user: appUser, pwd: appPassword, roles: [{ role: ROLE, db: dbName }] });
  print(`Usuário '${appUser}' criado com a role '${ROLE}'`);
}
