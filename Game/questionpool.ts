import router from "../utils/router.ts";
import { executeQuery } from "../database/client.ts";

// Créer un nouveau pool de questions
router.post("/questionpool", async (ctx) => {
  try {
    const body = await ctx.request.body().value;

    // Validation des données
    if (!body.name) {
      ctx.response.status = 400;
      ctx.response.body = { error: "Le nom du pool est requis" };
      return;
    }

    // Insérer le nouveau pool
    const poolResult = await executeQuery(
      "INSERT INTO QuestionPool (name, description, user_id, is_public) VALUES ($1, $2, $3, $4) RETURNING id, name, description, is_public, created_at",
      [body.name, body.description || null, body.userId, body.is_public || false]
    );

    if (poolResult && poolResult.rows && poolResult.rows.length > 0) {
      ctx.response.status = 201;
      ctx.response.body = poolResult.rows[0] as Record<string, unknown>;
    } else {
      ctx.response.status = 500;
      ctx.response.body = { error: "Erreur lors de la création du pool de questions" };
    }
  } catch (error) {
    console.error("Erreur lors de la création du pool de questions:", error);
    ctx.response.status = 500;
    ctx.response.body = { error: "Échec de la création du pool de questions" };
  }
});

// Récupérer la liste des pools
router.get("/questionpool", async (ctx) => {
    try {
      let userId = 0
      let query = `
        SELECT qp.id, qp.name, qp.description, qp.is_public, qp.created_at, 
        u.username as created_by,
        (SELECT COUNT(*) FROM QuestionPool_Questions WHERE pool_id = qp.id) as question_count
        FROM QuestionPool qp
        LEFT JOIN users u ON qp.user_id = u.id
        WHERE qp.is_public = true OR qp.user_id = $1
        ORDER BY qp.created_at DESC
      `;
      
      const result = await executeQuery(query, [userId || 0]);

      const serializedRows = (result && result.rows)
        ? result.rows.map(row => {
            const serializedRow: Record<string, any> = {};
            for (const [key, value] of Object.entries(row as Record<string, unknown>)) {
              serializedRow[key] = typeof value === 'bigint' ? Number(value) : value;
            }
            return serializedRow;
          })
        : [];

  
      console.log("Résultat de la requête:", serializedRows);
      ctx.response.status = 200;
      ctx.response.body = serializedRows;
    } catch (error) {
      console.error("Erreur lors de la récupération des pools de questions:", error);
      ctx.response.status = 500;
      ctx.response.body = { error: "Échec de la récupération des pools de questions" };
    }
  });

// Ajouter des questions à un pool
router.post("/questionpool/:id/questions", async (ctx) => {
  try {
    const { id } = ctx.params;
    const body = await ctx.request.body().value;
    const questionIds = body.question_ids || [];
    
    if (!Array.isArray(questionIds) || questionIds.length === 0) {
      ctx.response.status = 400;
      ctx.response.body = { error: "La liste des IDs de questions est requise" };
      return;
    }

    // Vérifier que le pool existe et appartient à l'utilisateur
    const poolResult = await executeQuery(
      "SELECT id FROM QuestionPool WHERE id = $1 AND (user_id = $2 OR is_public = true)",
      [id, ctx.state.user?.id || 0]
    );
    
    if (!poolResult || !poolResult.rows || poolResult.rows.length === 0) {
      ctx.response.status = 404;
      ctx.response.body = { error: "Pool de questions non trouvé ou accès non autorisé" };
      return;
    }

    // Ajouter les questions au pool
    const positionResult = await executeQuery(
      "SELECT COALESCE(MAX(position), 0) as max_pos FROM QuestionPool_Questions WHERE pool_id = $1",
      [id]
    );
    const rows = (positionResult && typeof positionResult === 'object' && 'rows' in positionResult)
      ? (positionResult as { rows: any[] }).rows
      : [];
    const maxPos = rows.length > 0 && rows[0].max_pos !== undefined ? Number(rows[0].max_pos) : 0;
    let currentPosition = maxPos + 1;
    
    for (const questionId of questionIds) {
      try {
        await executeQuery(
          "INSERT INTO QuestionPool_Questions (pool_id, question_id, position) VALUES ($1, $2, $3) ON CONFLICT (pool_id, question_id) DO NOTHING",
          [id, questionId, currentPosition++]
        );
      } catch (insertError) {
        console.error(`Erreur lors de l'ajout de la question ${questionId}:`, insertError);
        // Continue with next question
      }
    }
    
    ctx.response.status = 200;
    ctx.response.body = { message: "Questions ajoutées au pool avec succès" };
  } catch (error) {
    console.error("Erreur lors de l'ajout de questions au pool:", error);
    ctx.response.status = 500;
    ctx.response.body = { error: "Échec de l'ajout de questions au pool" };
  }
});

router.get("/questionpool/:id/questions", async (ctx) => {
    try {
      const { id } = ctx.params;
      const userId = ctx.state.user?.id;
  
      // Vérifier que le pool existe et que l'utilisateur a le droit d'y accéder
      const poolResult = await executeQuery(
        "SELECT id, name FROM QuestionPool WHERE id = $1 AND (user_id = $2 OR is_public = true)",
        [id, userId || 0]
      );
      
      if (!poolResult || !poolResult.rows || poolResult.rows.length === 0) {
        ctx.response.status = 404;
        ctx.response.body = { error: "Pool de questions non trouvé ou accès non autorisé" };
        return;
      }
  
      // Récupérer toutes les questions du pool avec les informations complètes
      const query = `
        SELECT q.id, q.question, q.answer, q.question_type, q.media, 
               s.name as subtheme, t.name as theme,
               pqq.position
        FROM QuestionPool_Questions pqq
        JOIN Questions q ON pqq.question_id = q.id
        LEFT JOIN Subthemes s ON q.subtheme_id = s.id
        LEFT JOIN Themes t ON s.theme_id = t.id
        WHERE pqq.pool_id = $1
        ORDER BY pqq.position ASC
      `;
      
      const result = await executeQuery(query, [id]);
      
      // Conversion des BigInt en Number pour la sérialisation
      const serializedRows = (result && result.rows)
        ? result.rows.map(row => {
            const serializedRow: Record<string, any> = {};
            for (const [key, value] of Object.entries(row as Record<string, unknown>)) {
              serializedRow[key] = typeof value === 'bigint' ? Number(value) : value;
            }
            return serializedRow;
          })
        : [];
      
      ctx.response.status = 200;
      ctx.response.body = {
        pool_id: Number(id),
        pool_name: (poolResult.rows[0] as { name: string }).name,
        questions: serializedRows
      };
    } catch (error) {
      console.error("Erreur lors de la récupération des questions du pool:", error);
      ctx.response.status = 500;
      ctx.response.body = { error: "Échec de la récupération des questions du pool" };
    }
  });

export default router;