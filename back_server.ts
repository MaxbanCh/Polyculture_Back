import { Application } from "https://deno.land/x/oak@v12.6.1/mod.ts";
import { oakCors } from "https://deno.land/x/cors/mod.ts";
import router from "./utils/router.ts";
import questionsRouter from "./Game/questionsdb.ts";
import profilRouter from "./Users/profil.ts";
import wsRouter from "./utils/websocket.ts";
import gameRouter from "./Game/gameManager.ts";
import questionPoolRouter from "./Game/questionpool.ts";
import { initializeDatabase } from "./database/client.ts";
import buzzerManager from "./Game/buzzerManager.ts";


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

router.get("/get_cookies", (ctx) => {
  ctx.response.status = 200;
  ctx.response.body = "Miam les cookies !";
});

const PORT = parseInt("3000");
const options: any = { port: PORT };

// if (Deno.args.length >= 3) {
//   options.secure = true;
//   options.cert = await Deno.readTextFile(Deno.args[1]);
//   options.key = await Deno.readTextFile(Deno.args[2]);
//   console.log(`SSL conf ready (use https)`);
// }

console.log(`Oak back server running on port ${options.port}`);

/////////////////////////////////////////////////////////////////////

app.use(async (ctx, next) => {
  await next();
  console.log(ctx.request.url.pathname);
});

await initializeDatabase(); // Initialize the database connection and tables

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

app.use(questionPoolRouter.routes());
app.use(questionPoolRouter.allowedMethods());

app.use(buzzerManager.routes());
app.use(buzzerManager.allowedMethods());

await app.listen(options);
