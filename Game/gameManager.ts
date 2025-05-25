import router from "../utils/websocket.ts";
import client, { executeQuery } from "../database/client.ts";

export interface WebSocketWithData extends WebSocket {
  data?: {
    userId: string;
    username: string;
    roomCode?: string;
  };
}

interface Room {
  code: string;
  host: string;
  players: { id: string; username: string; ready: boolean }[];
  selectedThemes: string[];
  poolId?: number; // Ajout du poolId
  status: "waiting" | "playing" | "finished";
  scores: Record<string, number>;
  totalRounds?: number;
}

interface QuestionData {
  id: string;
  question: string;
  answer: string;
  theme: string;
}

interface PlayerAnswer {
  username: string;
  answer: string;
  timestamp: number;
}

export const connections: WebSocketWithData[] = [];
export const rooms = new Map<string, Room>();
export const gameSessions = new Map<string, GameSession>();

function generateRoomCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function broadcastToRoom(roomCode: string, data: any) {
  const room = rooms.get(roomCode);
  if (!room) return;

  connections.forEach((client) => {
    if (client.data?.roomCode === roomCode && client.readyState === 1) {
      // Only send if connection is OPEN (readyState === 1)
      client.send(JSON.stringify(data));
    }
  });
}
function notifyAllUsers(json: any) {
  connections.forEach((client) => {
    if (client.readyState === 1) {
      client.send(JSON.stringify(json));
    }
  });
}

// Game Logic
class GameSession {
  private room: Room;
  private questions: QuestionData[] = [];
  private currentQuestionIndex = 0;
  private playerAnswers = new Map<string, PlayerAnswer>();
  private questionStartTime: number = 0;
  private timePerQuestion = 20; // seconds
  private questionTimer?: number; // Ajouter cette propriété pour gérer le timer

  constructor(room: Room) {
    this.room = room;
  }

  async start() {
    // Fetch questions based on selected pool or themes
    if (this.room.poolId) {
      console.log(`Using question pool ID: ${this.room.poolId}`);
      this.questions = await this.fetchQuestionsByPool(
        this.room.poolId,
        this.room.totalRounds || 10
      );
    } else {
      console.log(`Using themes: ${this.room.selectedThemes.join(', ')}`);
      this.questions = await this.fetchQuestionsByThemes(
        this.room.selectedThemes, 
        this.room.totalRounds || 10
      );
    }
    
    if (this.questions.length === 0) {
      console.error("No questions found for the game!");
      broadcastToRoom(this.room.code, {
        type: "ERROR",
        message: "Aucune question trouvée. Veuillez choisir un autre thème ou pool."
      });
      return;
    }
    
    this.startNextQuestion();
  }

  private async fetchQuestionsByPool(poolId: number, count: number): Promise<QuestionData[]> {
    try {
      // Récupérer les questions du pool spécifié
      const query = `
        SELECT q.id, q.question, q.answer, t.name as theme, q.question_type as type, q.media
        FROM QuestionPool_Questions pqq
        JOIN Questions q ON pqq.question_id = q.id
        LEFT JOIN Subthemes s ON q.subtheme_id = s.id
        LEFT JOIN Themes t ON s.theme_id = t.id
        WHERE pqq.pool_id = $1
        ORDER BY RANDOM()
        LIMIT $2
      `;
      
      const result = await executeQuery(query, [poolId, count]);
      
      // Convertir le résultat en format attendu
      if (result && Array.isArray(result.rows)) {
        return result.rows.map((row: any) => ({
          id: String(row.id),
          question: row.question,
          answer: row.answer,
          theme: row.theme || "Général",
          type: row.type || "text",
          media: row.media
        }));
      } else {
        return this.getFallbackQuestions(count);
      }
    } catch (error) {
      console.error("Error fetching questions from pool:", error);
      return this.getFallbackQuestions(count);
    }
  }


  private async fetchQuestionsByThemes(themes: string[], count: number): Promise<QuestionData[]> {
    try {
      // Cette partie reste identique à votre implémentation actuelle
      // Utilise getQuestionsByThemes ou interroge directement la base
      return await getQuestionsByThemes(themes, count);
    } catch (error) {
      console.error("Error fetching questions by themes:", error);
      return this.getFallbackQuestions(count);
    }
  }
  
  
  private getFallbackQuestions(count: number): QuestionData[] {
    // Questions de secours au cas où la récupération échoue
    return [
      { id: "1", question: "What is the capital of France?", answer: "Paris", theme: "Geography" },
      { id: "2", question: "Who painted the Mona Lisa?", answer: "Leonardo da Vinci", theme: "Art" },
      // Reste des questions inchangé
    ].slice(0, count);
  }

  
  private startNextQuestion() {
    if (this.currentQuestionIndex < this.questions.length) {
      const question = this.questions[this.currentQuestionIndex];
      
      // Clear previous answers and timer
      this.playerAnswers.clear();
      if (this.questionTimer) {
        clearTimeout(this.questionTimer);
      }
      this.questionStartTime = Date.now();
      
      // Send new question to all players
      broadcastToRoom(this.room.code, {
        type: 'NEW_QUESTION',
        question: {
          id: question.id,
          question: question.question,
          theme: question.theme
        },
        round: this.currentQuestionIndex + 1,
        timeLimit: this.timePerQuestion,
        totalRounds: this.questions.length
      });
      
      // Set timer for question end - CORRECTION: utiliser this.timePerQuestion au lieu d'une valeur fixe
      this.questionTimer = setTimeout(() => {
        this.endQuestion();
      }, this.timePerQuestion * 1000);
    } else {
      this.endGame();
    }
  }

  submitAnswer(playerId: string, username: string, answer: string, timestamp: number) {
    if (!this.playerAnswers.has(playerId)) {
      this.playerAnswers.set(playerId, {
        username,
        answer,
        timestamp
      });
      
      // If all players answered, end the question early
      if (this.playerAnswers.size === this.room.players.length) {
        // Clear the timer since all players have answered
        if (this.questionTimer) {
          clearTimeout(this.questionTimer);
        }
        this.endQuestion();
      }
    }
  }

  private endQuestion() {
    // Clear the timer
    if (this.questionTimer) {
      clearTimeout(this.questionTimer);
      this.questionTimer = undefined;
    }

    const currentQuestion = this.questions[this.currentQuestionIndex];
    const correctAnswer = currentQuestion.answer;
    
    // Calculate points based on timing
    const results: {
      correctAnswer: string;
      playerResults: {
        playerId: string;
        username: string;
        answer: string;
        isCorrect: boolean;
        points: number;
        time: string;
      }[];
    } = {
      correctAnswer,
      playerResults: []
    };
    
    const correctResponses: { playerId: string; timestamp: number }[] = [];
    
    // First pass: identify correct answers
    for (const [playerId, data] of this.playerAnswers.entries()) {
      const isCorrect = this.isAnswerCorrect(data.answer, correctAnswer);
      if (isCorrect) {
        correctResponses.push({
          playerId,
          timestamp: data.timestamp
        });
      }
    }
    
    // Sort by timestamp (fastest first)
    correctResponses.sort((a, b) => a.timestamp - b.timestamp);
    
    // Award points based on order
    correctResponses.forEach((response, index) => {
      // Points: 10 for first, 8 for second, 6 for third, 5 for rest
      const points = index === 0 ? 10 : index === 1 ? 8 : index === 2 ? 6 : 5;
      
      if (!this.room.scores[response.playerId]) {
        this.room.scores[response.playerId] = 0;
      }
      
      this.room.scores[response.playerId] += points;
    });
    
    // Prepare results for all players
    for (const [playerId, data] of this.playerAnswers.entries()) {
      const isCorrect = this.isAnswerCorrect(data.answer, correctAnswer);
      const responseIndex = correctResponses.findIndex(r => r.playerId === playerId);
      const points = responseIndex >= 0 ? 
        (responseIndex === 0 ? 10 : responseIndex === 1 ? 8 : responseIndex === 2 ? 6 : 5) : 0;
        
      results.playerResults.push({
        playerId,
        username: data.username,
        answer: data.answer,
        isCorrect,
        points,
        time: ((data.timestamp - this.questionStartTime) / 1000).toFixed(1)
      });
    }
    
    // Send results to all players
    broadcastToRoom(this.room.code, {
      type: 'ROUND_ENDED',
      results,
      scores: this.room.scores
    });
    
    // Move to next question after a delay
    setTimeout(() => {
      this.currentQuestionIndex++;
      this.startNextQuestion();
    }, 5000);
  }
  
  private isAnswerCorrect(userAnswer: string, correctAnswer: string): boolean {
    // Simple exact match - you could implement more sophisticated matching
    return userAnswer.toLowerCase().trim() === correctAnswer.toLowerCase().trim();
  }
  
  private endGame() {
    // Clear any remaining timer
    if (this.questionTimer) {
      clearTimeout(this.questionTimer);
      this.questionTimer = undefined;
    }

    broadcastToRoom(this.room.code, {
      type: 'GAME_ENDED',
      finalScores: this.room.scores
    });
    
    // Reset room status
    this.room.status = 'finished';
  }
}

// WebSocket Message Handlers
function createRoom(data: any, ws: WebSocketWithData) {
  const roomCode = generateRoomCode();
  const newRoom: Room = {
    code: roomCode,
    host: data.userId,
    players: [{ id: data.userId, username: data.username, ready: false }],
    selectedThemes: [],
    status: "waiting",
    scores: {},
  };
  rooms.set(roomCode, newRoom);
  ws.data = { userId: data.userId, username: data.username, roomCode };
  ws.send(JSON.stringify({ type: "ROOM_CREATED", room: newRoom }));
}

function joinRoom(data: any, ws: WebSocketWithData) {
  const room = rooms.get(data.roomCode);
  if (room && room.status === "waiting") {
    room.players.push({
      id: data.userId,
      username: data.username,
      ready: false,
    });
    ws.data = { userId: data.userId, username: data.username, roomCode: data.roomCode };
    ws.send(JSON.stringify({ type: "ROOM_JOINED", room: room }));

    broadcastToRoom(data.roomCode, {
      type: "PLAYER_JOINED",
      players: room.players,
    });
  } else {
    ws.send(JSON.stringify({ 
      type: "ERROR", 
      message: "Room not found or game in progress" 
    }));
  }
}

function startGame(data: any, ws: WebSocketWithData) {
  const room = rooms.get(data.roomCode);
  if (!room || room.host !== ws.data?.userId) {
    ws.send(JSON.stringify({ 
      type: "ERROR", 
      message: "Room not found or you're not the host" 
    }));
    return;
  }
  
  // Update room settings
  room.status = "playing";
  room.selectedThemes = data.themes || [];
  room.poolId = data.poolId;
  room.totalRounds = data.totalRounds || 10;
  room.scores = {};

  console.log(`Starting game for room: ${data.roomCode}`);
  console.log(`Pool ID: ${data.poolId || 'None'}`);
  console.log(`Themes: ${(data.themes || []).join(', ')}`);
  
  
  // Create and start a game session
  const session = new GameSession(room);
  gameSessions.set(data.roomCode, session);
  
  // Notify all players that the game is starting
  broadcastToRoom(data.roomCode, {
    type: "GAME_STARTED",
    scores: room.scores
  });
  
  // Start the game
  console.log("Starting game for room:", data.roomCode);
  session.start().catch(error => {
    console.error("Error starting game:", error);
    broadcastToRoom(data.roomCode, {
      type: "ERROR",
      message: "Failed to start game"
    });
  });
}

function submitAnswer(data: any, ws: WebSocketWithData) {
  const { roomCode, userId, username, answer, timestamp } = data;
  if (!roomCode || !userId || !answer) {
    return;
  }
  
  const session = gameSessions.get(roomCode);
  if (session) {
    session.submitAnswer(userId, username || ws.data?.username || "Unknown", answer, timestamp);
  }
}

router.get("/Multi", (ctx) => {
  if (!ctx.isUpgradable) {
    ctx.throw(501);
  }
  const ws = ctx.upgrade() as WebSocketWithData;
  connections.push(ws);

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    console.log("Received message:", data.type);

    // Handle existing message types
    if (data.type === "buzz" || data.type === "question" || data.type === "answer") {
      // Handle these existing message types as before
      if (data.type === "buzz") {
        console.log(`- buzzer pressed by ${data.data.name}`);
        notifyAllUsers({ type: "buzz", owner: data.data.name });
      } else if (data.type === "question") {
        console.log(`- question asked by ${data.data.name}`);
        notifyAllUsers({
          type: "question",
          owner: data.data.name,
          question: data.data.question,
        });
      } else if (data.type === "answer") {
        console.log(`- answer sent by ${data.data.name}`);
        notifyAllUsers({
          type: "answer",
          owner: data.data.name,
          answer: data.data.answer,
        });
      }
      return;
    }

    // Handle game-related message types
    switch (data.type) {
      case "CREATE_ROOM":
        createRoom(data, ws);
        break;
      case "JOIN_ROOM":
        joinRoom(data, ws);
        break;
      case "START_GAME":
        console.log("Starting game with data:", data);
        startGame(data, ws);
        break;
      case "SUBMIT_ANSWER":
        submitAnswer(data, ws);
        break;
      case "LEAVE_ROOM":
        // Handle in onclose
        break;
      default:
        console.log("Unknown message type:", data.type);
        break;
    }
  };

  ws.onclose = () => {
    const index = connections.indexOf(ws);
    if (index !== -1) {
      if (ws.data?.roomCode) {
        const room = rooms.get(ws.data.roomCode);
        if (room) {
          room.players = room.players.filter((p) => p.id !== ws.data?.userId);
          if (room.players.length === 0) {
            rooms.delete(ws.data.roomCode);
            gameSessions.delete(ws.data.roomCode);
          } else {
            if (room.host === ws.data.userId) {
              room.host = room.players[0].id;
            }
            broadcastToRoom(ws.data.roomCode, {
              type: "PLAYER_LEFT",
              players: room.players,
              newHost: room.host,
            });
          }
        }
      }
      connections.splice(index, 1);
    }
  };
});


async function getQuestionsByThemes(themes: string[], count: number): Promise<QuestionData[]> {
  try {
    let query = `
      SELECT q.id, q.question, q.answer, q.question_type as type, q.media,
             t.name as theme, s.name as subtheme
      FROM Questions q
      LEFT JOIN Subthemes s ON q.subtheme_id = s.id
      LEFT JOIN Themes t ON s.theme_id = t.id
    `;
    
    const params: any[] = [];
    
    // If themes are specified, add WHERE clause
    if (themes && themes.length > 0) {
      query += " WHERE t.name = ANY($1)";
      params.push(themes);
    }
    
    // Add ORDER BY RANDOM() and LIMIT
    query += " ORDER BY RANDOM() LIMIT $" + (params.length + 1);
    params.push(count);
    
    const result = await executeQuery(query, params);
    
    // Process the results
    if (result && Array.isArray(result.rows)) {
      return result.rows.map((row: any) => ({
        id: String(row.id),
        question: row.question,
        answer: row.answer,
        theme: row.theme || "Général",
        type: row.type || "text",
        media: row.media
      }));
    }
    
    // IIf there is an error or no results, return fallback questions
    console.warn("No questions found for themes:", themes);
    return [
      { id: "1", question: "What is the capital of France?", answer: "Paris", theme: "Geography" },
      { id: "2", question: "Who painted the Mona Lisa?", answer: "Leonardo da Vinci", theme: "Art" },
      { id: "3", question: "What is the chemical symbol for gold?", answer: "Au", theme: "Science" },
      { id: "4", question: "Which planet is known as the Red Planet?", answer: "Mars", theme: "Astronomy" },
      { id: "5", question: "What is the tallest mountain in the world?", answer: "Mount Everest", theme: "Geography" },
      { id: "6", question: "Who wrote 'Romeo and Juliet'?", answer: "William Shakespeare", theme: "Literature" },
      { id: "7", question: "What is the largest organ in the human body?", answer: "Skin", theme: "Biology" },
      { id: "8", question: "In which year did World War II end?", answer: "1945", theme: "History" },
      { id: "9", question: "What is the capital of Japan?", answer: "Tokyo", theme: "Geography" },
      { id: "10", question: "Who discovered penicillin?", answer: "Alexander Fleming", theme: "Science" }
    ].slice(0, count);
  } catch (error) {
    console.error("Error fetching questions:", error);
    return [];
  }
}

export default router;