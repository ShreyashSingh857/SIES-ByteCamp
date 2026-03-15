const clients = new Map();

export function addClient(repoId, res) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.write(":connected\n\n");

  if (!clients.has(repoId)) {
    clients.set(repoId, new Set());
  }

  const group = clients.get(repoId);
  group.add(res);

  const heartbeat = setInterval(() => {
    try {
      res.write(":ping\n\n");
    } catch {
      clearInterval(heartbeat);
      group.delete(res);
    }
  }, 25000);

  res.on("close", () => {
    clearInterval(heartbeat);
    group.delete(res);
    if (group.size === 0) {
      clients.delete(repoId);
    }
  });
}

export function broadcast(repoId, payload) {
  const group = clients.get(repoId);
  if (!group?.size) {
    return;
  }

  const body = `data: ${JSON.stringify(payload)}\n\n`;
  for (const res of group) {
    try {
      res.write(body);
    } catch {
      group.delete(res);
    }
  }
}

export function clientCount(repoId) {
  return clients.get(repoId)?.size || 0;
}
