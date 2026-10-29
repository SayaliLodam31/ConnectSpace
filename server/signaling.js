const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

const CONFIG_FILE = path.join(__dirname, '..', '.config', 'ports.json');
let port = 5017;

if (fs.existsSync(CONFIG_FILE)) {
  try {
    const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    if (config.signaling) port = config.signaling;
  } catch (e) {}
}

// Security Configuration
const MAX_PAYLOAD_BYTES = 64 * 1024; // 64 KB maximum message size to prevent memory DoS
const MAX_MESSAGES_PER_SEC = 50;     // Rate limit per client connection
const ID_REGEX = /^[a-zA-Z0-9_\-\.]{1,64}$/; // Valid format for room and user identifiers

// Allowed origins for WebSocket CORS verification
function isAllowedOrigin(origin) {
  if (!origin) return true; // Allow non-browser direct clients / internal scripts
  try {
    const url = new URL(origin);
    const host = url.hostname;
    // Allow localhost and local loopback
    if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0') return true;
    
    // Check against configured production app URL if present
    const envAppUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (envAppUrl) {
      const allowedUrl = new URL(envAppUrl);
      if (allowedUrl.hostname === host) return true;
    }
  } catch (e) {
    return false;
  }
  return false;
}

const wss = new WebSocket.Server({
  port,
  maxPayload: MAX_PAYLOAD_BYTES,
  verifyClient: (info, callback) => {
    const origin = info.origin || info.req.headers.origin;
    if (isAllowedOrigin(origin)) {
      callback(true);
    } else {
      console.warn(`[Signaling Security] Blocked connection from unauthorized origin: ${origin}`);
      callback(false, 403, 'Forbidden origin');
    }
  },
});

const rooms = new Map();

console.log(`[Signaling Server] Running on ws://localhost:${port} (Security Hardened)`);

wss.on('connection', (ws, req) => {
  let userRoom = null;
  let currentUserId = null;
  let messageCount = 0;
  let lastReset = Date.now();

  ws.on('message', (message) => {
    // 1. Rate limiting check
    const now = Date.now();
    if (now - lastReset > 1000) {
      messageCount = 0;
      lastReset = now;
    }
    messageCount++;
    if (messageCount > MAX_MESSAGES_PER_SEC) {
      console.warn(`[Signaling RateLimit] User ${currentUserId || 'unknown'} exceeded rate limit. Dropping message.`);
      return;
    }

    try {
      const data = JSON.parse(message);
      if (!data || typeof data !== 'object') return;

      switch (data.type) {
        case 'join': {
          const rawRoom = String(data.meetingCode || '').trim();
          const rawUser = String(data.userId || '').trim();

          // Input validation
          if (!ID_REGEX.test(rawRoom) || !ID_REGEX.test(rawUser)) {
            ws.send(JSON.stringify({ type: 'error', message: 'Invalid room or user identifier' }));
            return;
          }

          userRoom = rawRoom;
          currentUserId = rawUser;

          if (!rooms.has(userRoom)) {
            rooms.set(userRoom, new Map());
          }
          rooms.get(userRoom).set(currentUserId, ws);
          console.log(`[Signaling] Verified user ${currentUserId} joined room ${userRoom}`);
          break;
        }

        default: {
          // Relay message only if socket has joined a room
          if (!userRoom || !currentUserId || !rooms.has(userRoom)) {
            return;
          }

          // Anti-spoofing: enforce that 'from' matches the authenticated socket userId
          data.from = currentUserId;
          const sanitizedPayload = JSON.stringify(data);

          const roomPeers = rooms.get(userRoom);
          if (data.target && roomPeers.has(data.target)) {
            const targetWs = roomPeers.get(data.target);
            if (targetWs && targetWs.readyState === WebSocket.OPEN) {
              targetWs.send(sanitizedPayload);
            }
          } else {
            // Broadcast to other peers in the same room
            for (const [peerId, peerWs] of roomPeers.entries()) {
              if (peerId !== currentUserId && peerWs.readyState === WebSocket.OPEN) {
                peerWs.send(sanitizedPayload);
              }
            }
          }
          break;
        }
      }
    } catch (e) {
      console.error('[Signaling Error] Malformed message received:', e.message);
    }
  });

  ws.on('close', () => {
    if (userRoom && currentUserId && rooms.has(userRoom)) {
      const roomPeers = rooms.get(userRoom);
      roomPeers.delete(currentUserId);
      if (roomPeers.size === 0) {
        rooms.delete(userRoom);
      }
      console.log(`[Signaling] User ${currentUserId} left room ${userRoom}`);
    }
  });
});
