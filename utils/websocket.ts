import { Router } from "https://deno.land/x/oak@v12.6.1/mod.ts";
import router from "./router.ts";

export interface WebSocketWithData extends WebSocket {
  data?: {
    userId: string;
    username: string;
    roomCode?: string;
  }
}

export const connections: WebSocketWithData[] = [];
export const rooms = new Map<string, Room>();

function generateRoomCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function broadcastToRoom(roomCode: string, data: any) {
  const room = rooms.get(roomCode);
  if (!room) return;

  connections.forEach((client) => {
    // const player = room.players.find(p => p.id === client.data?.userId);
    if (client.data?.roomCode === roomCode) {
      client.send(JSON.stringify(data));
    }
  });
}

function notifyAllUsers(json: any) {
  connections.forEach((client) => {
    client.send(JSON.stringify(json));
  });
}



function createRoom(data: any, ws: WebSocket) {
  const roomCode = generateRoomCode();
  const newRoom: Room = {
    code: roomCode,
    host: data.userId,
    players: [{id: data.userId, username: data.username, ready: false}],
    selectedThemes: [],
    status: 'waiting',
    scores: {}
  };
  rooms.set(roomCode, newRoom);
  ws.data = { userId: data.userId, roomCode };
  ws.send(JSON.stringify({type: 'ROOM_CREATED', room: newRoom}));
}

function joinRoom(data: any, ws: WebSocket) {
  const room = rooms.get(data.roomCode);
  if (room) {
    room.players.push({
      id: data.userId,
      username: data.username,
      ready: false
    });
    ws.data = { userId: data.userId, roomCode: data.roomCode };
    broadcastToRoom(data.roomCode, {
      type: 'PLAYER_JOINED',
      players: room.players
    });
  } else {
    ws.send(JSON.stringify({type: 'ROOM_NOT_FOUND'}));
  }
}

function startGame(data: any, ws: WebSocket) {
  const room = rooms.get(data.roomCode);
  if (room) {
    room.status = 'playing';
    ws.send(JSON.stringify({type: 'GAME_STARTED', room}));
    broadcastToRoom(data.roomCode, {type: 'GAME_STARTED', room});
  } else {
    ws.send(JSON.stringify({type: 'ROOM_NOT_FOUND'}));
  }
}

function submitAnswer(data: any, ws: WebSocket) {
  const gameInProgress = rooms.get(data.roomCode);
        if (gameInProgress && gameInProgress.status === 'playing') {
          // Gérer la réponse et mettre à jour les scores
          // Envoyer les résultats à tous les joueurs
        }
}

router.get("/", (ctx) => {
  if (!ctx.isUpgradable) {
    ctx.throw(501);
  }
  const ws = ctx.upgrade();
  connections.push(ws);
  // console.log(ws);

  ws.onmessage = async (event) => {
    const data = JSON.parse(event.data);
    console.log(data);
    console.log(data.type)

    if (data.type == "buzz") {
      // if (user.last_action_date + 1000 > Date.now()) {
      //     ws.send(JSON.stringify({ too_early: true }));
      //     return
      // }
      console.log(`- buzzer pressed by ${data.data.name}`);
      // user.last_action_date = Date.now();
      notifyAllUsers({ type: "buzz", owner: data.data.name });
      return
    }

    if (data.type == "question") {
      console.log(`- question asked by ${data.data.name}`);
      notifyAllUsers({ type: "question", owner: data.data.name, question: data.data.question });
      return
    }

    if (data.type == "answer") {
      console.log(`- answer sent by ${data.data.name}`);
      notifyAllUsers({ type: "answer", owner: data.data.name, answer: data.data.answer });
      return
    }

    if (data.type === "CREATE_ROOM") {
      createRoom(data, ws);
    } else if (data.type === "JOIN_ROOM") {
      joinRoom(data, ws);
    } else if (data.type === "START_GAME") {
      startGame(data, ws);
    } else if (data.type === "SUBMIT_ANSWER") {
      submitAnswer(data, ws);
    } else {
      console.log("Unknown message type:", data.type);
    }
  };

  ws.onclose = () => {
    const index = connections.indexOf(ws);
    if (index !== -1) {
      if (ws.data?.roomCode) {
        const room = rooms.get(ws.data.roomCode);
        if (room) {
          room.players = room.players.filter(p => p.id !== ws.data.userId);
          if (room.players.length === 0) {
            rooms.delete(ws.data.roomCode);
          } else {
            if (room.host === ws.data.userId) {
              room.host = room.players[0].id;
            }
            broadcastToRoom(ws.data.roomCode, {
              type: 'PLAYER_LEFT',
              players: room.players,
              newHost: room.host
            });
          }
        }
      }
      connections.splice(index, 1);
    }
  };
});

export default router;
