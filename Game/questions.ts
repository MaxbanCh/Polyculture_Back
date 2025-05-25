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

const themes: string[] = [];
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

  const question =
    filteredQuestions[Math.floor(Math.random() * filteredQuestions.length)];
  ctx.response.status = 200;
  ctx.response.body = question;
});

router.post("/answer", async (ctx) => {
  const body = await ctx.request.body().value;
  const { questionId, answer } = body;

  try {
    // Récupérer la question et son type
    const questionResult = await executeQuery(
      "SELECT id, question, answer, question_type FROM Questions WHERE id = $1",
      [questionId]
    );

    if ((questionResult as any).rows.length === 0) {
      ctx.response.status = 404;
      ctx.response.body = { error: "Question not found" };
      return;
    }

    const question = (questionResult as any).rows[0];

    // Vérifier la réponse selon le type de question
    if (question.question_type === 'choice') {
      // Pour les questions à choix multiple, vérifier si la réponse est correcte
      const reponseResult = await executeQuery(
        "SELECT est_correcte FROM Reponses WHERE question_id = $1 AND id = $2",
        [questionId, answer]
      );

      if ((reponseResult as any).rows.length === 0) {
        ctx.response.status = 404;
        ctx.response.body = { error: "Answer option not found" };
        return;
      }

      const isCorrect = (reponseResult as any).rows[0].est_correcte;
      ctx.response.status = 200;
      ctx.response.body = { correct: isCorrect };
    } else {
      // Pour les questions de type texte, utiliser la nouvelle fonction de comparaison
      const isCorrect = compareAnswers(answer, question.answer);
      ctx.response.status = 200;
      ctx.response.body = { correct: isCorrect };
    }
  } catch (error) {
    console.error("Error checking answer:", error);
    ctx.response.status = 500;
    ctx.response.body = { error: "Failed to check answer" };
  }
});

router.get("/question", async (ctx) => {
  const questionId = ctx.request.url.searchParams.get("id");

  // Si un ID est fourni, renvoyer la question spécifique
  if (questionId) {
    // Récupérer la question depuis la base de données avec ses réponses si c'est une question de type choice
    const questionResult = await executeQuery(
      `SELECT q.id, q.question, q.answer, q.question_type, t.name as theme, s.name as subtheme 
       FROM Questions q
       LEFT JOIN Subthemes s ON q.subtheme_id = s.id
       LEFT JOIN Themes t ON s.theme_id = t.id
       WHERE q.id = $1`,
      [questionId]
    );

    if (!questionResult || (questionResult as any).rows.length === 0) {
      ctx.response.status = 404;
      ctx.response.body = { error: "Question not found" };
      return;
    }

    const question = (questionResult as any).rows[0];

    // Si c'est une question de type choice, récupérer les réponses possibles
    if (question.question_type === 'choice') {
      const reponsesResult = await executeQuery(
        `SELECT id, texte, est_correcte FROM Reponses WHERE question_id = $1 ORDER BY id`,
        [question.id]
      );

      question.options = (reponsesResult as any).rows;
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
    questions: filteredQuestions.slice(startIndex, endIndex),
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

    // 1. Insérer la question
    const result = await executeQuery(
      `INSERT INTO Questions (subtheme_id, question, question_type, answer) 
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [
        body.subtheme_id || null,
        body.question,
        body.question_type || "text",
        body.answer,
      ]
    );

    const newQuestionId = (result as any).rows[0].id;

    // 2. Si c'est une question à choix multiples, insérer les réponses
    if (body.question_type === "choice" && Array.isArray(body.options)) {
      for (const option of body.options) {
        await executeQuery(
          `INSERT INTO Reponses (question_id, texte, est_correcte) 
           VALUES ($1, $2, $3)`,
          [newQuestionId, option.texte, option.est_correcte || false]
        );
      }
    }

    // 3. Récupérer la question complète avec ses réponses
    const newQuestion = await executeQuery(
      `SELECT q.id, q.question, q.answer, q.question_type, t.name as theme, s.name as subtheme 
       FROM Questions q
       LEFT JOIN Subthemes s ON q.subtheme_id = s.id
       LEFT JOIN Themes t ON s.theme_id = t.id
       WHERE q.id = $1`,
      [newQuestionId]
    );

    let questionData = (newQuestion as any).rows[0];

    // Si c'est une question à choix multiples, récupérer les réponses
    if (body.question_type === "choice") {
      const options = await executeQuery(
        `SELECT id, texte, est_correcte FROM Reponses WHERE question_id = $1`,
        [newQuestionId]
      );
      questionData.options = (options as any).rows;
    }

    ctx.response.status = 201;
    ctx.response.body = questionData;
  } catch (error) {
    console.error("Error creating question:", error);
    ctx.response.status = 500;
    ctx.response.body = { error: "Failed to create question" };
  }
});

// Mettre à jour une question existante (UPDATE)
router.put("/question/:id", async (ctx) => {
  try {
    const { id } = ctx.params;
    const body = await ctx.request.body().value;

    // 1. Vérifier si la question existe
    const questionExists = await executeQuery(
      "SELECT id, question_type FROM Questions WHERE id = $1",
      [id]
    );

    if ((questionExists as any).rows.length === 0) {
      ctx.response.status = 404;
      ctx.response.body = { error: "Question not found" };
      return;
    }

    const oldQuestionType = (questionExists as any).rows[0].question_type;

    // 2. Mettre à jour la question
    await executeQuery(
      `UPDATE Questions SET 
       subtheme_id = $1, question = $2, question_type = $3, answer = $4
       WHERE id = $5`,
      [
        body.subtheme_id || null,
        body.question,
        body.question_type || oldQuestionType,
        body.answer,
        id,
      ]
    );

    // 3. Gérer les réponses pour les questions de type choix
    if (body.question_type === "choice" && Array.isArray(body.options)) {
      // Supprimer les anciennes réponses
      await executeQuery("DELETE FROM Reponses WHERE question_id = $1", [id]);
      
      // Insérer les nouvelles réponses
      for (const option of body.options) {
        await executeQuery(
          `INSERT INTO Reponses (question_id, texte, est_correcte) 
           VALUES ($1, $2, $3)`,
          [id, option.texte, option.est_correcte || false]
        );
      }
    }

    // 4. Récupérer la question mise à jour avec ses réponses
    const updatedQuestion = await executeQuery(
      `SELECT q.id, q.question, q.answer, q.question_type, t.name as theme, s.name as subtheme 
       FROM Questions q
       LEFT JOIN Subthemes s ON q.subtheme_id = s.id
       LEFT JOIN Themes t ON s.theme_id = t.id
       WHERE q.id = $1`,
      [id]
    );

    let questionData = (updatedQuestion as any).rows[0];

    // Si c'est une question à choix multiples, récupérer les réponses
    if (questionData.question_type === "choice") {
      const options = await executeQuery(
        `SELECT id, texte, est_correcte FROM Reponses WHERE question_id = $1`,
        [id]
      );
      questionData.options = (options as any).rows;
    }

    ctx.response.status = 200;
    ctx.response.body = questionData;
  } catch (error) {
    console.error("Error updating question:", error);
    ctx.response.status = 500;
    ctx.response.body = { error: "Failed to update question" };
  }
});

// Supprimer une question (DELETE)
router.delete("/question/:id", async (ctx) => {
  try {
    const { id } = ctx.params;
    const index = questions.findIndex((q) =>
      q.id === parseInt(id) || q.id === id
    );

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
    ctx.response.body = {
      message: "Question deleted successfully",
      question: deletedQuestion,
    };
  } catch (_error) {
    ctx.response.status = 500;
    ctx.response.body = { error: "Failed to delete question" };
  }
});

export default router;


// Function to import question to the database via a JSON file
async function importQuestionsToDatabase() {
  try {
    const data = await Deno.readTextFile("./questions_with_ids.json");
    const questions = JSON.parse(data);

    // Step 1: Collect all unique themes and subthemes
    const uniqueThemes = new Set();
    const uniqueSubthemes = new Map(); // Map of {theme: Set(subthemes)}
    
    for (const question of questions) {
      const theme = question.theme?.trim() || "Général";
      const subtheme = question.subtheme?.trim() || null;
      
      uniqueThemes.add(theme);
      
      if (subtheme) {
        if (!uniqueSubthemes.has(theme)) {
          uniqueSubthemes.set(theme, new Set());
        }
        uniqueSubthemes.get(theme).add(subtheme);
      }
    }

    // Step 2: Insert themes and track their IDs
    const themeIds = new Map(); // Map of {themeName: themeId}
    for (const theme of uniqueThemes) {
      // Check if theme already exists
      const existingTheme = await executeQuery(
        "SELECT id FROM Themes WHERE name = $1",
        [theme]
      );
      
      if (existingTheme && Array.isArray((existingTheme as { rows: any[] }).rows) && (existingTheme as { rows: any[] }).rows.length > 0) {
        const rows = (existingTheme as { rows: any[] }).rows;
        themeIds.set(theme, rows[0].id);
      } else {
        // Insert new theme
        const result = await executeQuery(
          "INSERT INTO Themes (name) VALUES ($1) RETURNING id",
          [theme]
        );
        if (result && typeof result === "object" && "rows" in result && Array.isArray((result as { rows: any[] }).rows) && (result as { rows: any[] }).rows.length > 0) {
          const rows = (result as { rows: any[] }).rows;
          themeIds.set(theme, rows[0].id);
          console.log(`Theme inserted: ${theme} (ID: ${rows[0].id})`);
        } else {
          throw new Error(`Failed to insert theme: ${theme}`);
        }
      }
    }

    // Step 3: Insert subthemes and track their IDs
    const subthemeIds = new Map(); // Map of {theme_subtheme: subthemeId}
    
    for (const [theme, subthemes] of uniqueSubthemes.entries()) {
      const themeId = themeIds.get(theme);
      
      for (const subtheme of subthemes) {
        // Check if subtheme already exists
        const existingSubtheme = await executeQuery(
          "SELECT id FROM Subthemes WHERE name = $1 AND theme_id = $2",
          [subtheme, themeId]
        );
        
        if (
          existingSubtheme &&
          Array.isArray((existingSubtheme as { rows: any[] }).rows) &&
          (existingSubtheme as { rows: any[] }).rows.length > 0
        ) {
          const rows = (existingSubtheme as { rows: any[] }).rows;
          subthemeIds.set(`${theme}_${subtheme}`, rows[0].id);
        } else {
          // Insert new subtheme
          const result = await executeQuery(
            "INSERT INTO Subthemes (name, theme_id) VALUES ($1, $2) RETURNING id",
            [subtheme, themeId]
          );
          if (
            result &&
            typeof result === "object" &&
            "rows" in result &&
            Array.isArray((result as { rows: any[] }).rows) &&
            (result as { rows: any[] }).rows.length > 0
          ) {
            const rows = (result as { rows: any[] }).rows;
            subthemeIds.set(`${theme}_${subtheme}`, rows[0].id);
            console.log(`Subtheme inserted: ${subtheme} (Theme: ${theme}, ID: ${rows[0].id})`);
          } else {
            throw new Error(`Failed to insert subtheme: ${subtheme} for theme: ${theme}`);
          }
        }
      }
    }

    // Step 4: Insert questions with proper references
    let questionsInserted = 0;
    
    for (const question of questions) {
      const theme = question.theme?.trim() || "Général";
      const subtheme = question.subtheme?.trim() || null;
      const subthemeId = subtheme ? subthemeIds.get(`${theme}_${subtheme}`) : null;
      const questionType = question.type || "text";
      
      // Insérer la question
      const result = await executeQuery(
        "INSERT INTO Questions (subtheme_id, question, question_type, answer) VALUES ($1, $2, $3, $4) RETURNING id",
        [
          subthemeId,
          question.question,
          questionType,
          question.answer
        ]
      );
      
      const questionId = (result as any).rows[0].id;
      
      // Si c'est une question à choix multiples, insérer les options de réponse
      if (questionType === "choice" && Array.isArray(question.options)) {
        for (const option of question.options) {
          await executeQuery(
            "INSERT INTO Reponses (question_id, texte, est_correcte) VALUES ($1, $2, $3)",
            [questionId, option.texte, option.est_correcte || false]
          );
        }
      }
      
      questionsInserted++;
      if (questionsInserted % 10 === 0) {
        console.log(`${questionsInserted} questions inserted...`);
      }
    }
    
    console.log(`Import completed. ${questionsInserted} questions inserted in total.`);
  } catch (error) {
    console.error("Error importing questions:", error);
    throw error; // Re-throw to handle in the route handler
  }
}

router.get("/import-questions", async (ctx) => {
  try {
    await importQuestionsToDatabase();
    ctx.response.status = 200;
    ctx.response.body = { message: "Questions imported successfully" };
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = { error: "Failed to import questions" };
  }
}
);


function normalizeString(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;
  
  // Matrice pour la programmation dynamique
  const dp: number[][] = Array(len1 + 1)
    .fill(null)
    .map(() => Array(len2 + 1).fill(0));
  
  // Initialisation de la matrice
  for (let i = 0; i <= len1; i++) dp[i][0] = i;
  for (let j = 0; j <= len2; j++) dp[0][j] = j;
  
  // Remplissage de la matrice
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,         // suppression
        dp[i][j - 1] + 1,         // insertion
        dp[i - 1][j - 1] + cost   // substitution
      );
    }
  }
  
  return dp[len1][len2];
}

function compareAnswers(
  userAnswer: string, 
  correctAnswer: string, 
  tolerance: number = 2
): boolean {
  // Normalisation des réponses (suppression des accents et mise en minuscules)
  const normalizedUserAnswer = normalizeString(userAnswer);
  const normalizedCorrectAnswer = normalizeString(correctAnswer);
  
  // Si les chaînes normalisées sont identiques, la réponse est correcte
  if (normalizedUserAnswer === normalizedCorrectAnswer) {
    return true;
  }
  
  // Calcul de la distance d'édition
  const distance = levenshteinDistance(normalizedUserAnswer, normalizedCorrectAnswer);
  
  // La réponse est considérée comme correcte si la distance est inférieure ou égale à la tolérance
  return distance <= tolerance;
}