import client, { executeQuery } from "../database/client.ts";
import router from "../utils/router.ts";
import { create, verify } from "https://deno.land/x/djwt@v2.8/mod.ts";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.0/mod.ts";
import { Application } from "https://deno.land/x/oak@v12.6.1/mod.ts";
import { oakCors } from "https://deno.land/x/cors/mod.ts";

router.options("/login", (ctx) => {
  ctx.response.status = 200;
  ctx.response.headers.set("Access-Control-Allow-Origin", "http://83.195.188.17");
  ctx.response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  ctx.response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  ctx.response.headers.set("Access-Control-Allow-Credentials", "true");
});

router.options("/register", (ctx) => {
  ctx.response.status = 200;
  ctx.response.headers.set("Access-Control-Allow-Origin", "http://83.195.188.17");
  ctx.response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  ctx.response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  ctx.response.headers.set("Access-Control-Allow-Credentials", "true");
});

// const users = [
//   { id: '1', username: 'Superman', password_hash: await get_hash('Superman'), last_action_date: 0 },
//   { id: '2', username: 'Mickey_Mouse', password_hash: await get_hash('Mickey_Mouse'), last_action_date: 0 },
//   { id: '3', username: 'James_Bond', password_hash: await get_hash('James_Bond'), last_action_date: 0 },
//   { id: '4', username: 'Bugs_Bunny', password_hash: await get_hash('Bugs_Bunny'), last_action_date: 0 },
//   { id: '5', username: 'Batman', password_hash: await get_hash('Batman'), last_action_date: 0 },
//   { id: '6', username: 'Dorothy_Gale', password_hash: await get_hash('Dorothy_Gale'), last_action_date: 0 },
//   { id: '0', username: 'Maxban', password_hash: await get_hash('Maxban'), last_action_date: 0 },
// ];

// const modifmdp = await executeQuery(
//   "UPDATE users SET password_hash = $1 WHERE username = 'admin'",
//   [await get_hash('admin')]
// );

// const usersTemp = await executeQuery(
//   "SELECT id, username, password_hash FROM users"
// );
// console.log(usersTemp.rows);
// // if (users.rows.length === 0) {
// //   console.log("No users found in the database.");
// // }
// const users = usersTemp.rows;

// console.log(users);


const secretKey = await crypto.subtle.generateKey(
  { name: "HMAC", hash: "SHA-512" },
  true,
  ["sign", "verify"]
);


// Connection related variables
const tokens: { [key: string]: string } = {};

// Function to remove a token based on the user
function removeTokenByUser(user: string) {
  for (const token in tokens) {
    if (tokens[token] === user) {
      delete tokens[token];
      break;
    }
  }
}

async function get_hash(password: string): Promise<string> {
  const saltRounds = 10;
  const salt = await bcrypt.genSalt(saltRounds);  // Generate the salt manually
  return await bcrypt.hash(password, salt);  // Pass the salt to the hash function
}

router.post("/login", async (ctx) => {
  const body = await ctx.request.body().value;
  const { username, password } = body;

  if (!username || !password || 
    typeof username !== 'string' || typeof password !== 'string' ||
    username.length > 50) { // Limiter la taille du nom d'utilisateur
    ctx.response.status = 400;
    ctx.response.body = { error: "Invalid input format" };
    return;
  }

// Nettoyage des entrées (trim pour enlever les espaces inutiles)
  const sanitizedUsername = username.trim();

  const userResult = await executeQuery(
    "SELECT id, username, password_hash FROM users WHERE username = $1",
    [sanitizedUsername]
  );

  if (userResult.rows.length === 0) {
    ctx.response.status = 401;
    ctx.response.body = { error: "Invalid username or password" };
    return;
  }
  
  const user = userResult.rows[0];

  if (!user) {
    ctx.response.status = 401;
    ctx.response.body = { error: "Invalid username or password" };
    return;
  }

  const result = await bcrypt.compare(password, user.password_hash);
  if (!result) {
    ctx.response.status = 401;
    ctx.response.body = { error: "Invalid username or password" };
    return;
  }

  const token = await create({ alg: "HS512", typ: "JWT" }, { userName: username }, secretKey);
  ctx.response.headers.set("Set-Cookie", `auth_token=${token}; HttpOnly; Max-Age=3600; SameSite=Strict; `);

  removeTokenByUser(username);
  tokens[token] = username;

  ctx.response.status = 200;
  ctx.response.body = { auth_token: token };
});


router.post("/register", async (ctx) => {
  const body = await ctx.request.body().value;
  console.log(body);
  const { username, password } = body;
  
  // Validation des entrées
  if (!username || !password || 
      typeof username !== 'string' || typeof password !== 'string' ||
      username.length < 3 || username.length > 50 || // S'assurer que le nom d'utilisateur a une longueur raisonnable
      password.length < 8) { // S'assurer que le mot de passe a une longueur minimale
    ctx.response.status = 400;
    ctx.response.body = { error: "Invalid input format. Username must be between 3-50 characters and password at least 8 characters." };
    return;
  }
  
  // Vérifier que le nom d'utilisateur ne contient que des caractères alphanumériques et quelques caractères spéciaux acceptables
  const usernameRegex = /^[a-zA-Z0-9_.-]+$/;
  if (!usernameRegex.test(username)) {
    ctx.response.status = 400;
    ctx.response.body = { error: "Username can only contain letters, numbers, and the following characters: _ . -" };
    return;
  }

  // Nettoyage des entrées
  const sanitizedUsername = username.trim();
  
  const existingUserResult = await executeQuery(
    "SELECT username FROM users WHERE username = $1",
    [sanitizedUsername]
  );
  
  if (existingUserResult.rows.length > 0) {
    ctx.response.status = 409;
    ctx.response.body = { error: "Username already exists" };
    return;
  }  
  
  const hashedPassword = await get_hash(password);
  
  // Insérer le nouvel utilisateur dans la base de données
  try {
    await executeQuery(
      "INSERT INTO users (username, password_hash, description, admin) VALUES ($1, $2, $3, $4)",
      [sanitizedUsername, hashedPassword, '', false]
    );
    
    // Créer un token pour l'utilisateur nouvellement inscrit
    const token = await create({ alg: "HS512", typ: "JWT" }, { userName: sanitizedUsername }, secretKey);
    ctx.response.headers.set("Set-Cookie", `auth_token=${token}; HttpOnly; Max-Age=3600; SameSite=Strict; `);
    
    tokens[token] = sanitizedUsername;
    
    ctx.response.status = 200;
    ctx.response.body = { auth_token: token };
  } catch (error) {
    console.error("Error during user registration:", error);
    ctx.response.status = 500;
    ctx.response.body = { error: "An error occurred during registration" };
  }
});


  router.post("/logout", async (ctx) => {
    const token = ctx.request.headers.get("Authorization")?.split(" ")[1];
    if (!token) {
      ctx.response.status = 401;
      ctx.response.body = { error: "No token provided" };
      return;
    }

    const user = tokens[token];
    if (user) {
      delete tokens[token];
      ctx.response.headers.set("Set-Cookie", `auth_token=; HttpOnly; Max-Age=0; SameSite=Strict; `);
      ctx.response.status = 200;
      ctx.response.body = { message: "Logged out successfully" };
    } else {
      ctx.response.status = 401;
      ctx.response.body = { error: "Invalid token" };
    }
  });

  router.get("/profil", async (ctx) => {
    const token = ctx.request.headers.get("Authorization")?.split(" ")[1];
    if (!token) {
      ctx.response.status = 401;
      ctx.response.body = { error: "No token provided" };
      return;
    }

    const user = tokens[token];
    if (!user) {
      ctx.response.status = 401;
      ctx.response.body = { error: "Invalid token" };
      return;
    }

    const decodedToken = await verify(token, secretKey);
    if (!decodedToken) {
      ctx.response.status = 401;
      ctx.response.body = { error: "Invalid token" };
      return;
    }

    ctx.response.status = 200;
    ctx.response.body = { userName: decodedToken.userName };
  });

  router.get("/admin", async (ctx) => {
    const authHeader = ctx.request.headers.get("Authorization");
    if (!authHeader) {
      ctx.response.status = 401;
      ctx.response.body = { error: "Unauthorized" };
      return;
    }

    const token = authHeader.split(" ")[1];
    try {
      const payload = await verify(token, secretKey);
      if (payload.role !== "admin") {
        ctx.response.status = 403;
        ctx.response.body = { error: "Forbidden" };
        return;
      }

      ctx.response.status = 200;
      ctx.response.body = { isAdmin: true };
    } catch {
      ctx.response.status = 401;
      ctx.response.body = { error: "Invalid token" };
    }
  });

  export default router;
