import { Application } from "https://deno.land/x/oak@v12.6.1/mod.ts";
import { oakCors } from "https://deno.land/x/cors/mod.ts";
import router from "./utils/router.ts";
import questionsRouter from "./Game/questionsdb.ts";
import profilRouter from "./Users/profil.ts";
import wsRouter from "./utils/websocket.ts";
import gameRouter from "./Game/gameManager.ts";

const app = new Application();

app.use(
  oakCors({
    origin: "http://83.195.188.17", // Allow requests from this origin
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"], // Specify allowed methods
    allowedHeaders: ["Content-Type", "Authorization"], // Specify allowed headers
    credentials: true, // Allow credentials like cookies
  }),
);

app.use(async (ctx, next) => {
  ctx.response.headers.set(
    "Access-Control-Allow-Origin",
    "http://83.195.188.17",
  );
  ctx.response.headers.set(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS",
  );
  ctx.response.headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization",
  );
  ctx.response.headers.set("Access-Control-Allow-Credentials", "true");
  await next();
});

// // WebSockets -----
// const is_authorized = async (auth_token: string) => {
//   if (!auth_token) {
//     return false;
//   }
//   console.log("auth_token", auth_token);
//   if (auth_token in tokens) {
//     try {
//       const payload = await verify(auth_token, secretKey);
//       if (payload.userName === tokens[auth_token]) {
//         return true;
//       }
//     } catch {
//       console.log("verify token failed");
//       return false;
//     }
//   }
//   console.log("Unknown token");
//   return false;
// };

router.get("/get_cookies", (ctx) => {
  ctx.response.status = 200;
  ctx.response.body = "Miam les cookies !";
});

if (Deno.args.length < 1) {
  console.log(
    `Usage: $ deno run --allow-net server.ts PORT [CERT_PATH KEY_PATH]`,
  );
  Deno.exit();
}

const options = { port: Deno.args[0] };

if (Deno.args.length >= 3) {
  options.secure = true;
  options.cert = await Deno.readTextFile(Deno.args[1]);
  options.key = await Deno.readTextFile(Deno.args[2]);
  console.log(`SSL conf ready (use https)`);
}

console.log(`Oak back server running on port ${options.port}`);

/////////////////////////////////////////////////////////////////////

app.use(async (ctx, next) => {
  await next();
  console.log(ctx.request.url.pathname);
});

app.use(router.routes());
app.use(router.allowedMethods());

app.use(questionsRouter.routes());
app.use(questionsRouter.allowedMethods());

app.use(profilRouter.routes());
app.use(profilRouter.allowedMethods());

app.use(wsRouter.routes());
app.use(wsRouter.allowedMethods());

app.use(gameRouter.routes());
app.use(gameRouter.allowedMethods());

await app.listen(options);
