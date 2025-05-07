import { Router } from "https://deno.land/x/oak@v12.6.1/mod.ts";
import router from "../utils/router.ts";

// Load questions from JSON file
let questions: any[] = [];
try {
  const data = await Deno.readTextFile("./questions_with_ids.json");
  questions = JSON.parse(data);
} catch (error) {
  console.error("Error loading questions:", error);
}

let themes: string[] = [];
questions.forEach((question) => {
  if (question.theme && !themes.includes(question.theme)) {
    themes.push(question.theme);
  }
});


// Define routes
router.get("/themes", (ctx) => {
  ctx.response.status = 200;
  ctx.response.body = { themes };
});

router.get("/question", (ctx) => {
  const theme = ctx.request.url.searchParams.get("theme");
  let filteredQuestions = questions;

  if (theme) {
    filteredQuestions = questions.filter((q) =>
      q.theme.toLowerCase().includes(theme.toLowerCase())
    );
  }

  if (filteredQuestions.length === 0) {
    ctx.response.status = 404;
    ctx.response.body = { error: "No questions found for the given theme." };
    return;
  }

  const question = filteredQuestions[Math.floor(Math.random() * filteredQuestions.length)];
  ctx.response.status = 200;
  ctx.response.body = question;
});

router.post("/answer", async (ctx) => {
  const body = await ctx.request.body().value;
  const { questionId, answer } = body;
  const question = questions.find((q) => q.id === questionId);
  if (!question) {
    ctx.response.status = 404;
    ctx.response.body = { error: "Question not found" };
    return;
  }
  if (question.answer.toLowerCase() === answer.toLowerCase()) {
    ctx.response.status = 200;
    ctx.response.body = { correct: true };
  }
  else {
    ctx.response.status = 200;
    ctx.response.body = { correct: false };
  }
});

export default router;