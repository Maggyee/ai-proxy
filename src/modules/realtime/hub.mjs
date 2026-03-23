const socketsByUser = new Map();

export function registerSocket(userId, socket) {
  const sockets = socketsByUser.get(userId) ?? new Set();
  sockets.add(socket);
  socketsByUser.set(userId, sockets);

  socket.on('close', () => {
    sockets.delete(socket);
    if (sockets.size === 0) {
      socketsByUser.delete(userId);
    }
  });
}

export function broadcastToUser(userId, event, payload) {
  const sockets = socketsByUser.get(userId);
  if (!sockets) {
    return;
  }

  const message = JSON.stringify({
    event,
    payload,
    sentAt: new Date().toISOString(),
  });

  for (const socket of sockets) {
    if (socket.readyState === 1) {
      socket.send(message);
    }
  }
}
