import router from "../utils/router.ts";
import { executeQuery } from "../database/client.ts";
import { tokens } from "../Users/profil.ts";

// Define routes
router.get("/themes", async (ctx) => {
  try {
    const themeResult = await executeQuery(
      "SELECT id, name FROM Themes ORDER BY name",
      []
    );
    
    ctx.response.status = 200;
    ctx.response.body = { themes: themeResult?.rows ?? [] };
  } catch (error) {
    console.error("Error fetching themes:", error);
    ctx.response.status = 500;
    ctx.response.body = { error: "Failed to fetch themes" };
  }
});

router.get("/randomquestion", async (ctx) => {
  try {
    const theme = ctx.request.url.searchParams.get("theme");
    let query = `
      SELECT q.id, q.question, q.answer, q.question_type, t.name as theme, s.name as subtheme
      FROM Questions q
      LEFT JOIN Subthemes s ON q.subtheme_id = s.id
      LEFT JOIN Themes t ON s.theme_id = t.id
    `;
    
    const params = [];
    if (theme) {
      query += " WHERE t.name ILIKE $1";
      params.push(`%${theme}%`);
    }
    
    query += " ORDER BY RANDOM() LIMIT 1";
    
    const result = await executeQuery(query, params);
    
    if (!result || !result.rows || result.rows.length === 0) {
      ctx.response.status = 404;
      ctx.response.body = { error: "No questions found for the given theme." };
      return;
    }
    
    ctx.response.status = 200;
    ctx.response.body = result.rows[0] as Record<string, unknown>;
  } catch (error) {
    console.error("Error fetching random question:", error);
    ctx.response.status = 500;
    ctx.response.body = { error: "Failed to fetch random question" };
  }
});

router.post("/answer", async (ctx) => {
  try {
    const body = await ctx.request.body().value;
    const { questionId, answer } = body;
    
    const result = await executeQuery(
      "SELECT answer FROM Questions WHERE id = $1",
      [questionId]
    );
    
    if (!result || !result.rows || result.rows.length === 0) {
      ctx.response.status = 404;
      ctx.response.body = { error: "Question not found" };
      return;
    }
    
    const row = result.rows[0] as { answer: string };
    const correctAnswer = row.answer;
    const isCorrect = correctAnswer.toLowerCase() === answer.toLowerCase();
    
    ctx.response.status = 200;
    ctx.response.body = { correct: isCorrect };
  } catch (error) {
    console.error("Error checking answer:", error);
    ctx.response.status = 500;
    ctx.response.body = { error: "Failed to check answer" };
  }
});

router.get("/question", async (ctx) => {
  try {
    const questionId = ctx.request.url.searchParams.get("id");

    // If an ID is provided, return the specific question
    if (questionId) {
      const result = await executeQuery(
        `SELECT q.id, q.question, q.answer, q.question_type, t.name as theme, s.name as subtheme
        FROM Questions q
        LEFT JOIN Subthemes s ON q.subtheme_id = s.id
        LEFT JOIN Themes t ON s.theme_id = t.id
        WHERE q.id = $1`,
        [questionId]
      );

      if (!result || !result.rows || result.rows.length === 0) {
        ctx.response.status = 404;
        ctx.response.body = { error: "Question not found" };
        return;
      }

      ctx.response.status = 200;
      ctx.response.body = result.rows[0] as Record<string, unknown>;
      return;
    }

    // If no ID is provided, return all questions (with optional pagination)
    const page = parseInt(ctx.request.url.searchParams.get("page") || "1");
    const limit = parseInt(ctx.request.url.searchParams.get("limit") || "20");
    const theme = ctx.request.url.searchParams.get("theme");

    let query = `
      SELECT q.id, q.question, q.answer, q.question_type, t.name as theme, s.name as subtheme
      FROM Questions q
      LEFT JOIN Subthemes s ON q.subtheme_id = s.id
      LEFT JOIN Themes t ON s.theme_id = t.id
    `;
    
    const params = [];
    if (theme) {
      query += " WHERE t.name ILIKE $1";
      params.push(`%${theme}%`);
    }
    
    // Get total count for pagination
    const countQuery = `SELECT COUNT(*) FROM (${query}) as subquery`;
    const countResult = await executeQuery(countQuery, params);
    if (!countResult || !('rows' in countResult) || !Array.isArray(countResult.rows) || countResult.rows.length === 0) {
      ctx.response.status = 500;
      ctx.response.body = { error: "Failed to count questions" };
      return;
    }
    const totalQuestions = parseInt((countResult.rows[0] as { count: string }).count);
    
    // Add pagination to the main query
    query += ` ORDER BY q.id LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit);
    params.push((page - 1) * limit);
    
    const result = await executeQuery(query, params);
    
    ctx.response.status = 200;
    ctx.response.body = {
      totalQuestions,
      totalPages: Math.ceil(totalQuestions / limit),
      currentPage: page,
      questions: result?.rows ?? []
    };
  } catch (error) {
    console.error("Error fetching questions:", error);
    ctx.response.status = 500;
    ctx.response.body = { error: "Failed to fetch questions" };
  }
});

router.post("/question", async (ctx) => {
  try {
    const body = await ctx.request.body().value;

    // Validate required fields
    if (!body.question || !body.answer) {
      ctx.response.status = 400;
      ctx.response.body = { error: "Question and answer are required" };
      return;
    }

    const theme = body.theme?.trim() || "Général";
    const subtheme = body.subtheme?.trim() || null;
    
    // Get or create theme
    let themeId;
    const themeResult = await executeQuery(
      "SELECT id FROM Themes WHERE name = $1",
      [theme]
    );
    
    if (themeResult && themeResult.rows && themeResult.rows.length > 0) {
      themeId = (themeResult.rows as { id: number }[])[0].id;
    } else {
      const newThemeResult = await executeQuery(
        "INSERT INTO Themes (name) VALUES ($1) RETURNING id",
        [theme]
      );
      if (
        newThemeResult &&
        typeof newThemeResult === "object" &&
        "rows" in newThemeResult &&
        Array.isArray((newThemeResult as any).rows) &&
        (newThemeResult as any).rows.length > 0
      ) {
        themeId = (newThemeResult as { rows: { id: number }[] }).rows[0].id;
      } else {
        throw new Error("Failed to insert new theme");
      }
    }
    
    // Get or create subtheme if provided
    let subthemeId = null;
    if (subtheme) {
      const subthemeResult = await executeQuery(
        "SELECT id FROM Subthemes WHERE name = $1 AND theme_id = $2",
        [subtheme, themeId]
      );
      
      if (subthemeResult && subthemeResult.rows && subthemeResult.rows.length > 0) {
        subthemeId = (subthemeResult.rows as { id: number }[])[0].id;
      } else {
        const newSubthemeResult = await executeQuery(
          "INSERT INTO Subthemes (name, theme_id) VALUES ($1, $2) RETURNING id",
          [subtheme, themeId]
        );
        if (
          newSubthemeResult &&
          typeof newSubthemeResult === "object" &&
          "rows" in newSubthemeResult &&
          Array.isArray((newSubthemeResult as any).rows) &&
          (newSubthemeResult as any).rows.length > 0
        ) {
          subthemeId = (newSubthemeResult as { rows: { id: number }[] }).rows[0].id;
        } else {
          throw new Error("Failed to insert new subtheme");
        }
      }
    }
    
    // Insert the new question
    const result = await executeQuery(
      "INSERT INTO Questions (subtheme_id, question, question_type, answer) VALUES ($1, $2, $3, $4) RETURNING id",
      [
        subthemeId,
        body.question,
        body.question_type || "text",
        body.answer
      ]
    );

    // Type guard for result
    if (
      !result ||
      typeof result !== "object" ||
      !("rows" in result) ||
      !Array.isArray((result as any).rows) ||
      (result as any).rows.length === 0
    ) {
      throw new Error("Failed to insert new question");
    }
    const newQuestionId = (result as { rows: { id: number }[] }).rows[0].id;
    const newQuestionResult = await executeQuery(
      `SELECT q.id, q.question, q.answer, q.question_type, t.name as theme, s.name as subtheme
      FROM Questions q
      LEFT JOIN Subthemes s ON q.subtheme_id = s.id
      LEFT JOIN Themes t ON s.theme_id = t.id
      WHERE q.id = $1`,
      [newQuestionId]
    );

    ctx.response.status = 201;
    if (
      newQuestionResult &&
      typeof newQuestionResult === "object" &&
      "rows" in newQuestionResult &&
      Array.isArray((newQuestionResult as any).rows) &&
      (newQuestionResult as any).rows.length > 0
    ) {
      ctx.response.body = (newQuestionResult as { rows: any[] }).rows[0];
    } else {
      ctx.response.status = 500;
      ctx.response.body = { error: "Failed to fetch the newly created question" };
    }
  } catch (error) {
    console.error("Error creating question:", error);
    ctx.response.status = 500;
    ctx.response.body = { error: "Failed to create question" };
  }
});

router.put("/question/:id", async (ctx) => {
  try {
    const { id } = ctx.params;
    const body = await ctx.request.body().value;

    // Check if the question exists
    const checkResult = await executeQuery(
      "SELECT id FROM Questions WHERE id = $1",
      [id]
    );
    
    if (!checkResult || !('rows' in checkResult) || !Array.isArray(checkResult.rows) || checkResult.rows.length === 0) {
      ctx.response.status = 404;
      ctx.response.body = { error: "Question not found" };
      return;
    }
    
    // Handle theme and subtheme if provided
    let subthemeId = null;
    
    if (body.theme) {
      const theme = body.theme.trim();
      const subtheme = body.subtheme?.trim() || null;
      
      // Get or create theme
      let themeId;
      const themeResult = await executeQuery(
        "SELECT id FROM Themes WHERE name = $1",
        [theme]
      );
      
      if (themeResult && themeResult.rows && themeResult.rows.length > 0) {
        themeId = (themeResult.rows as { id: number }[])[0].id;
      } else {
        const newThemeResult = await executeQuery(
          "INSERT INTO Themes (name) VALUES ($1) RETURNING id",
          [theme]
        );
        if (
          newThemeResult &&
          typeof newThemeResult === "object" &&
          "rows" in newThemeResult &&
          Array.isArray((newThemeResult as any).rows) &&
          (newThemeResult as any).rows.length > 0
        ) {
          themeId = (newThemeResult as { rows: { id: number }[] }).rows[0].id;
        } else {
          throw new Error("Failed to insert new theme");
        }
      }
      
      // Get or create subtheme if provided
      if (subtheme) {
        const subthemeResult = await executeQuery(
          "SELECT id FROM Subthemes WHERE name = $1 AND theme_id = $2",
          [subtheme, themeId]
        );
        
        if (subthemeResult && Array.isArray(subthemeResult.rows) && subthemeResult.rows.length > 0) {
          subthemeId = (subthemeResult.rows as { id: number }[])[0].id;
        } else {
          const newSubthemeResult = await executeQuery(
            "INSERT INTO Subthemes (name, theme_id) VALUES ($1, $2) RETURNING id",
            [subtheme, themeId]
          );
          if (
            newSubthemeResult &&
            typeof newSubthemeResult === "object" &&
            "rows" in newSubthemeResult &&
            Array.isArray((newSubthemeResult as any).rows) &&
            (newSubthemeResult as any).rows.length > 0
          ) {
            subthemeId = (newSubthemeResult as { rows: { id: number }[] }).rows[0].id;
          } else {
            throw new Error("Failed to insert new subtheme");
          }
        }
      }
    }
    
    // Build the UPDATE query dynamically
    const updates = [];
    const params = [id];
    let paramIndex = 2;
    
    if (body.question) {
      updates.push(`question = $${paramIndex++}`);
      params.push(body.question);
    }
    
    if (body.answer) {
      updates.push(`answer = $${paramIndex++}`);
      params.push(body.answer);
    }
    
    if (body.question_type) {
      updates.push(`question_type = $${paramIndex++}`);
      params.push(body.question_type);
    }
    
    // Only update subtheme_id if theme/subtheme was processed
    if (body.theme !== undefined) {
      updates.push(`subtheme_id = $${paramIndex++}`);
      params.push(subthemeId !== null ? String(subthemeId) : "");
    }
    
    if (updates.length === 0) {
      ctx.response.status = 400;
      ctx.response.body = { error: "No fields to update provided" };
      return;
    }
    
    const updateQuery = `UPDATE Questions SET ${updates.join(", ")} WHERE id = $1`;
    await executeQuery(updateQuery, params);
    
    // Fetch the updated question
    const result = await executeQuery(
      `SELECT q.id, q.question, q.answer, q.question_type, t.name as theme, s.name as subtheme
      FROM Questions q
      LEFT JOIN Subthemes s ON q.subtheme_id = s.id
      LEFT JOIN Themes t ON s.theme_id = t.id
      WHERE q.id = $1`,
      [id]
    );

    ctx.response.status = 200;
    ctx.response.body = (result && result.rows && result.rows.length > 0) ? result.rows[0] : {};
  } catch (error) {
    console.error("Error updating question:", error);
    ctx.response.status = 500;
    ctx.response.body = { error: "Failed to update question" };
  }
});

router.delete("/question/:id", async (ctx) => {
  try {
    const { id } = ctx.params;
    
    // Get the question first to return it in the response
    const questionResult = await executeQuery(
      `SELECT q.id, q.question, q.answer, q.question_type, t.name as theme, s.name as subtheme
      FROM Questions q
      LEFT JOIN Subthemes s ON q.subtheme_id = s.id
      LEFT JOIN Themes t ON s.theme_id = t.id
      WHERE q.id = $1`,
      [id]
    );
    
    if (!questionResult || !questionResult.rows || questionResult.rows.length === 0) {
      ctx.response.status = 404;
      ctx.response.body = { error: "Question not found" };
      return;
    }
    
    // Delete the question
    await executeQuery("DELETE FROM Questions WHERE id = $1", [id]);
    
    ctx.response.status = 200;
    ctx.response.body = {
      message: "Question deleted successfully",
      question: questionResult.rows[0]
    };
  } catch (error) {
    console.error("Error deleting question:", error);
    ctx.response.status = 500;
    ctx.response.body = { error: "Failed to delete question" };
  }
});

export default router;

// Function to import questions to the database via a JSON file
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
      
      if (existingTheme && Array.isArray(existingTheme.rows) && existingTheme.rows.length > 0) {
        themeIds.set(theme, (existingTheme.rows as { id: number }[])[0].id);
      } else {
        // Insert new theme
        const result = await executeQuery(
          "INSERT INTO Themes (name) VALUES ($1) RETURNING id",
          [theme]
        );
        if (
          result &&
          typeof result === "object" &&
          "rows" in result &&
          Array.isArray((result as any).rows) &&
          (result as any).rows.length > 0
        ) {
          themeIds.set(theme, (result as { rows: { id: number }[] }).rows[0].id);
          console.log(`Theme inserted: ${theme} (ID: ${(result as { rows: { id: number }[] }).rows[0].id})`);
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
        
        if (existingSubtheme && Array.isArray(existingSubtheme.rows) && existingSubtheme.rows.length > 0) {
          subthemeIds.set(`${theme}_${subtheme}`, existingSubtheme.rows[0].id);
        } else {
          // Insert new subtheme
          const result = await executeQuery(
            "INSERT INTO Subthemes (name, theme_id) VALUES ($1, $2) RETURNING id",
            [subtheme, themeId]
          );
          subthemeIds.set(`${theme}_${subtheme}`, result.rows[0].id);
          console.log(`Subtheme inserted: ${subtheme} (Theme: ${theme}, ID: ${result.rows[0].id})`);
        }
      }
    }

    // Step 4: Insert questions with proper references
    let questionsInserted = 0;
    
    for (const question of questions) {
      const theme = question.theme?.trim() || "Général";
      const subtheme = question.subtheme?.trim() || null;
      const subthemeId = subtheme ? subthemeIds.get(`${theme}_${subtheme}`) : null;
      
      await executeQuery(
        "INSERT INTO Questions (subtheme_id, question, question_type, answer) VALUES ($1, $2, $3, $4)",
        [
          subthemeId,
          question.question,
          question.question_type || "text",
          question.answer
        ]
      );
      
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

async function isAdmin(ctx: any, next: any) {
  try {
    // Récupérer le token d'autorisation
    const token = ctx.request.headers.get("Authorization")?.split(" ")[1];
    if (!token) {
      ctx.response.status = 401;
      ctx.response.body = { error: "Authentication required" };
      return;
    }
    
    // Vérifier si le token est valide et récupérer l'utilisateur associé
    const user = tokens[token];
    if (!user) {
      ctx.response.status = 401;
      ctx.response.body = { error: "Invalid token" };
      return;
    }
    
    // Vérifier en base de données si l'utilisateur est admin
    const userResult = await executeQuery(
      "SELECT id, username, admin FROM users WHERE username = $1",
      [user],
    ) as { rows?: { admin?: boolean }[] } | undefined;
    
    if (!userResult || !userResult.rows || userResult.rows.length === 0 || !userResult.rows[0].admin) {
      ctx.response.status = 403;
      ctx.response.body = { error: "Admin privileges required" };
      return;
    }
    
    // Si l'utilisateur est admin, continuer vers la prochaine étape
    await next();
  } catch (error) {
    console.error("Error in admin authorization:", error);
    ctx.response.status = 500;
    ctx.response.body = { error: "Server error during authorization" };
  }
}


router.get("/import-questions", isAdmin, async (ctx) => {
  try {
    await importQuestionsToDatabase();
    ctx.response.status = 200;
    ctx.response.body = { message: "Questions imported successfully" };
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = { error: "Failed to import questions" };
  }
});

router.get("/delete-all-questions", isAdmin, async (ctx) => {
    try {
        await executeQuery("DELETE FROM Questions", []);
        ctx.response.status = 200;
        ctx.response.body = { message: "All questions deleted successfully" };
    } catch (error) {
        console.error("Error deleting all questions:", error);
        ctx.response.status = 500;
        ctx.response.body = { error: "Failed to delete all questions" };
    }
    }
);

router.get("/delete-all-subthemes", isAdmin, async (ctx) => {
    try {
        await executeQuery("DELETE FROM Subthemes", []);
        ctx.response.status = 200;
        ctx.response.body = { message: "All subthemes deleted successfully" };
    } catch (error) {
        console.error("Error deleting all subthemes:", error);
        ctx.response.status = 500;
        ctx.response.body = { error: "Failed to delete all subthemes" };
    }
});

router.get("/delete-all-themes", isAdmin, async (ctx) => {
    try {
        await executeQuery("DELETE FROM Themes", []);
        ctx.response.status = 200;
        ctx.response.body = { message: "All themes deleted successfully" };
    } catch (error) {
        console.error("Error deleting all themes:", error);
        ctx.response.status = 500;
        ctx.response.body = { error: "Failed to delete all themes" };
    }
});

