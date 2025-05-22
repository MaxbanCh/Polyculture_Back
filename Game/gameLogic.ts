

// export class GameSession {
//   private room: Room;
//   private questions: any[] = [];
//   private currentQuestionIndex = 0;
//   private playerAnswers = new Map();
//   private questionTimer: number | null = null;
//   private timePerQuestion = 30; // seconds

//   constructor(room: Room) {
//     this.room = room;
//   }

//   async start() {
//     // Fetch questions based on selected themes
//     this.questions = await this.fetchQuestions(this.room.selectedThemes, this.room.totalRounds || 10);
//     this.startNextQuestion();
//   }
  
//   private async fetchQuestions(themes: string[], count: number) {
//     // Fetch random questions from your database based on themes
//     // This is a placeholder - implement actual database query
//     // ...
//   }
  
//   private startNextQuestion() {
//     if (this.currentQuestionIndex < this.questions.length) {
//       const question = this.questions[this.currentQuestionIndex];
      
//       // Clear previous answers
//       this.playerAnswers.clear();
      
//       // Send new question to all players
//       broadcastToRoom(this.room.code, {
//         type: 'NEW_QUESTION',
//         question: {
//           id: question.id,
//           question: question.question,
//           theme: question.theme
//         },
//         round: this.currentQuestionIndex + 1,
//         timeLimit: this.timePerQuestion
//       });
      
//       // Set timer for question end
//       setTimeout(() => this.endQuestion(), this.timePerQuestion * 1000);
//     } else {
//       this.endGame();
//     }
//   }
  
//   submitAnswer(playerId: string, username: string, answer: string, timestamp: number) {
//     if (!this.playerAnswers.has(playerId)) {
//       this.playerAnswers.set(playerId, {
//         username,
//         answer,
//         timestamp
//       });
      
//       // If all players answered, end the question early
//       if (this.playerAnswers.size === this.room.players.length) {
//         this.endQuestion();
//       }
//     }
//   }
  
//   private endQuestion() {
//     const currentQuestion = this.questions[this.currentQuestionIndex];
//     const correctAnswer = currentQuestion.answer;
    
//     // Calculate points based on timing
//     const results = {
//       correctAnswer,
//       playerResults: []
//     };
    
//     const correctResponses = [];
    
//     // First pass: identify correct answers
//     for (const [playerId, data] of this.playerAnswers.entries()) {
//       const isCorrect = this.isAnswerCorrect(data.answer, correctAnswer);
//       if (isCorrect) {
//         correctResponses.push({
//           playerId,
//           timestamp: data.timestamp
//         });
//       }
//     }
    
//     // Sort by timestamp (fastest first)
//     correctResponses.sort((a, b) => a.timestamp - b.timestamp);
    
//     // Award points based on order
//     correctResponses.forEach((response, index) => {
//       // Points: 10 for first, 8 for second, 6 for third, 5 for rest
//       const points = index === 0 ? 10 : index === 1 ? 8 : index === 2 ? 6 : 5;
      
//       if (!this.room.scores[response.playerId]) {
//         this.room.scores[response.playerId] = 0;
//       }
      
//       this.room.scores[response.playerId] += points;
//     });
    
//     // Prepare results for all players
//     for (const [playerId, data] of this.playerAnswers.entries()) {
//       const isCorrect = this.isAnswerCorrect(data.answer, correctAnswer);
//       const responseIndex = correctResponses.findIndex(r => r.playerId === playerId);
//       const points = responseIndex >= 0 ? 
//         (responseIndex === 0 ? 10 : responseIndex === 1 ? 8 : responseIndex === 2 ? 6 : 5) : 0;
        
//       results.playerResults.push({
//         playerId,
//         username: data.username,
//         answer: data.answer,
//         isCorrect,
//         points,
//         time: ((data.timestamp - this.questionStartTime) / 1000).toFixed(1)
//       });
//     }
    
//     // Send results to all players
//     broadcastToRoom(this.room.code, {
//       type: 'ROUND_ENDED',
//       results,
//       scores: this.room.scores
//     });
    
//     // Move to next question after a delay
//     setTimeout(() => {
//       this.currentQuestionIndex++;
//       this.startNextQuestion();
//     }, 5000);
//   }
  
//   private isAnswerCorrect(userAnswer: string, correctAnswer: string): boolean {
//     // Simple exact match - you could implement more sophisticated matching
//     return userAnswer.toLowerCase().trim() === correctAnswer.toLowerCase().trim();
//   }
  
//   private endGame() {
//     broadcastToRoom(this.room.code, {
//       type: 'GAME_ENDED',
//       finalScores: this.room.scores
//     });
    
//     // Reset room status
//     this.room.status = 'waiting';
//   }
// }
