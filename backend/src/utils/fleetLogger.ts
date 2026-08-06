import { Response } from "express";

let sseClients: Response[] = [];

export function addFleetLogClient(res: Response) {
  sseClients.push(res);
  
  // Clean up on client disconnect
  res.on('close', () => {
    sseClients = sseClients.filter(client => client !== res);
  });
}

export function emitFleetLog(message: string) {
  const timestamp = new Date().toLocaleTimeString();
  const logMessage = `[${timestamp}] ${message}`;
  
  // Log to backend console
  console.log(logMessage);
  
  // Broadcast to all connected SSE clients
  sseClients.forEach(client => {
    client.write(`data: ${JSON.stringify(logMessage)}\n\n`);
  });
}
