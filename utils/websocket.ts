import router from "./router.ts";

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
  status: "waiting" | "playing" | "finished";
  scores: Record<string, number>;
}

export const connections: WebSocketWithData[] = [];
export const rooms = new Map<string, Room>();

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

router.get("/", (ctx) => {
  if (!ctx.isUpgradable) {
    ctx.throw(501);
  }
  const ws = ctx.upgrade() as WebSocketWithData;
  connections.push(ws);
  // console.log(ws);

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    console.log(data);
    console.log(data.type);

    if (data.type == "buzz") {
      // if (user.last_action_date + 1000 > Date.now()) {
      //     ws.send(JSON.stringify({ too_early: true }));
      //     return
      // }
      console.log(`- buzzer pressed by ${data.data.name}`);
      // user.last_action_date = Date.now();
      notifyAllUsers({ type: "buzz", owner: data.data.name });
      return;
    }

    if (data.type == "question") {
      console.log(`- question asked by ${data.data.name}`);
      notifyAllUsers({
        type: "question",
        owner: data.data.name,
        question: data.data.question,
      });
      return;
    }

    if (data.type == "answer") {
      console.log(`- answer sent by ${data.data.name}`);
      notifyAllUsers({
        type: "answer",
        owner: data.data.name,
        answer: data.data.answer,
      });
      return;
    }
  };

  ws.onclose = () => {
    const index = connections.indexOf(ws);
    if (index !== -1) {
      if (ws.data && ws.data.roomCode) {
        const room = rooms.get(ws.data.roomCode);
        if (room) {
          room.players = room.players.filter((p) => p.id !== ws.data!.userId);
          if (room.players.length === 0) {
            rooms.delete(ws.data.roomCode);
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

export default router;
