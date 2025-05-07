// Back/Game/room.ts
import { WebSocket, WebSocketServer } from "ws";

const wss = new WebSocketServer({ port: 8080 });
const rooms = new Map<string, Room>();

wss.on('connection', (ws: WebSocket) => {
  ws.on('message', (message: string) => {
    const data = JSON.parse(message);
    
    switch (data.type) {
      case 'CREATE_ROOM':
        const roomCode = generateRoomCode();
        const room = {
          id: generateUUID(),
          code: roomCode,
          host: data.userId,
          players: [{id: data.userId, username: data.username, ready: false}],
          selectedThemes: [],
          status: 'waiting',
          scores: {}
        };
        rooms.set(roomCode, room);
        ws.send(JSON.stringify({type: 'ROOM_CREATED', room}));
        break;

      case 'JOIN_ROOM':
        const targetRoom = rooms.get(data.roomCode);
        if (targetRoom) {
          targetRoom.players.push({
            id: data.userId,
            username: data.username,
            ready: false
          });
          broadcastToRoom(targetRoom, {
            type: 'PLAYER_JOINED',
            players: targetRoom.players
          });
        }
        break;

      case 'START_GAME':
        // Logique de démarrage du jeu
        break;
    }
  });
});

function broadcastToRoom(room: Room, message: any) {
  // Envoyer le message à tous les joueurs de la room
}