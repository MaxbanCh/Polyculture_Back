// Back/Game/gameLogic.ts
class GameSession {
  private room: Room;
  private currentQuestionIndex: number = 0;
  private questions: Question[] = [];
  private playerAnswers: Map<string, {time: number, answer: string}> = new Map();

  constructor(room: Room) {
    this.room = room;
  }

  async start() {
    this.questions = await this.fetchQuestions(this.room.selectedThemes);
    this.nextQuestion();
  }

  private async nextQuestion() {
    if (this.currentQuestionIndex < this.questions.length) {
      const question = this.questions[this.currentQuestionIndex];
      this.playerAnswers.clear();
      this.broadcastQuestion(question);
    } else {
      this.endGame();
    }
  }

  handleAnswer(playerId: string, answer: string) {
    const answerTime = Date.now();
    this.playerAnswers.set(playerId, {time: answerTime, answer});

    if (this.playerAnswers.size === this.room.players.length) {
      this.evaluateAnswers();
    }
  }

  private evaluateAnswers() {
    const correctAnswers = Array.from(this.playerAnswers.entries())
      .filter(([_, data]) => this.isCorrectAnswer(data.answer))
      .sort((a, b) => a[1].time - b[1].time);

    // Attribution des points selon l'ordre des réponses
    correctAnswers.forEach(([playerId], index) => {
      const points = Math.max(3 - index, 1); // 3 points pour le 1er, 2 pour le 2e, 1 pour les suivants
      this.room.scores[playerId] += points;
    });

    this.broadcastResults();
    this.currentQuestionIndex++;
    setTimeout(() => this.nextQuestion(), 3000);
  }
}