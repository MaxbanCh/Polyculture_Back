import { Router } from "https://deno.land/x/oak@v12.6.1/mod.ts";
import router from "../utils/router.ts";
import client, { executeQuery } from "../database/client.ts";

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

router.get("/randomquestion", (ctx) => {
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

router.get("/question", async (ctx) => {
  const questionId = ctx.request.url.searchParams.get("id");
  
  // Si un ID est fourni, renvoyer la question spécifique
  if (questionId) {
    const question = questions.find((q) => q.id === parseInt(questionId) || q.id === questionId);
    // const question = await executeQuery(
    //     "SELECT questions.id, question, answer, theme, subtheme from 
    //     (SELECT * FROM questions WHERE id = $1)",
    //   [user]
    //   );
    
    if (!question) {
      ctx.response.status = 404;
      ctx.response.body = { error: "Question not found" };
      return;
    }
    
    ctx.response.status = 200;
    ctx.response.body = question;
    return;
  }
  
  // Si aucun ID n'est fourni, renvoyer toutes les questions (avec pagination optionnelle)
  const page = parseInt(ctx.request.url.searchParams.get("page") || "1");
  const limit = parseInt(ctx.request.url.searchParams.get("limit") || "20");
  const theme = ctx.request.url.searchParams.get("theme");
  
  let filteredQuestions = questions;
  
  // Filtrage par thème si spécifié
  if (theme) {
    filteredQuestions = questions.filter((q) =>
      q.theme.toLowerCase().includes(theme.toLowerCase())
    );
  }
  
  // Pagination
  const startIndex = (page - 1) * limit;
  const endIndex = page * limit;
  const results = {
    totalQuestions: filteredQuestions.length,
    totalPages: Math.ceil(filteredQuestions.length / limit),
    currentPage: page,
    questions: filteredQuestions.slice(startIndex, endIndex)
  };
  
  ctx.response.status = 200;
  ctx.response.body = results;
});

router.post("/question", async (ctx) => {
  try {
    const body = await ctx.request.body().value;
    
    // Validation des données minimales requises
    if (!body.question || !body.answer) {
      ctx.response.status = 400;
      ctx.response.body = { error: "Question and answer are required" };
      return;
    }
    
    // Générer un nouvel ID (en supposant que vous utilisez des ID numériques séquentiels)
    const newId = Math.max(...questions.map(q => parseInt(q.id.toString())), 0) + 1;
    
    const newQuestion = {
      id: newId,
      question: body.question,
      answer: body.answer,
      theme: body.theme || "Général",
      // Ajoutez d'autres champs selon votre modèle de données
    };
    
    // Ajouter à la liste en mémoire
    questions.push(newQuestion);
    
    // Potentiellement sauvegarder dans un fichier JSON ou une base de données
    // await Deno.writeTextFile("./questions_with_ids.json", JSON.stringify(questions));
    
    ctx.response.status = 201;
    ctx.response.body = newQuestion;
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = { error: "Failed to create question" };
  }
});

// Mettre à jour une question existante (UPDATE)
router.put("/question/:id", async (ctx) => {
  try {
    const { id } = ctx.params;
    const body = await ctx.request.body().value;
    
    const index = questions.findIndex(q => q.id === parseInt(id) || q.id === id);
    
    if (index === -1) {
      ctx.response.status = 404;
      ctx.response.body = { error: "Question not found" };
      return;
    }
    
    // Mettre à jour la question
    questions[index] = {
      ...questions[index],
      ...body,
      id: questions[index].id // Préserver l'ID original
    };
    
    // Potentiellement sauvegarder dans un fichier JSON ou une base de données
    // await Deno.writeTextFile("./questions_with_ids.json", JSON.stringify(questions));
    
    ctx.response.status = 200;
    ctx.response.body = questions[index];
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = { error: "Failed to update question" };
  }
});

// Supprimer une question (DELETE)
router.delete("/question/:id", async (ctx) => {
  try {
    const { id } = ctx.params;
    const index = questions.findIndex(q => q.id === parseInt(id) || q.id === id);
    
    if (index === -1) {
      ctx.response.status = 404;
      ctx.response.body = { error: "Question not found" };
      return;
    }
    
    // Supprimer la question
    const deletedQuestion = questions.splice(index, 1)[0];
    
    // Potentiellement sauvegarder dans un fichier JSON ou une base de données
    // await Deno.writeTextFile("./questions_with_ids.json", JSON.stringify(questions));
    
    ctx.response.status = 200;
    ctx.response.body = { message: "Question deleted successfully", question: deletedQuestion };
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = { error: "Failed to delete question" };
  }
});

export default router;