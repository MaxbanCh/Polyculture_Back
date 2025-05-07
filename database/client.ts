import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

const client = new Client({
  hostname: "database", // Matches the service name in docker-compose.yml
  port: 5432,
  user: "postgres",
  password: "admin",
  database: "polyculture",
});

let isConnected = false;

export async function connectToDatabase() {
  if (isConnected) {
    console.log("Database is already connected.");
    return;
  }

  let retries = 5;
  while (retries > 0) {
    try {
      await client.connect();
      isConnected = true;
      console.log("Connected to the database!");
      return;
    } catch (err) {
      console.error("Database connection failed. Retrying in 5 seconds...");
      retries--;
      await new Promise((res) => setTimeout(res, 5000));
    }
  }
  throw new Error("Could not connect to the database after multiple attempts.");
}

export async function disconnectFromDatabase() {
  if (!isConnected) {
    console.log("Database is not connected.");
    return;
  }

  try {
    await client.end();
    isConnected = false;
    console.log("Disconnected from the database.");
  } catch (err) {
    console.error("Error while disconnecting from the database:", err);
  }
}

export async function executeQuery(query, params) {
  if (!isConnected) await connectToDatabase();
  try {
    return await client.queryObject(query, params);
  } catch (error) {
    // Gestion appropriée des erreurs
  }
}

export async function withTransaction(callback) {
  if (!isConnected) await connectToDatabase();
  try {
    await client.queryObject("BEGIN");
    const result = await callback(client);
    await client.queryObject("COMMIT");
    return result;
  } catch (error) {
    await client.queryObject("ROLLBACK");
    throw error;
  }
}

export default client;