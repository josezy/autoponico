import { IncomingMessage } from 'http';
import WebSocket, { RawData, WebSocketServer } from 'ws';
import https from 'https';
import http from 'http';
import fs from 'fs';
import express from 'express';
import aedes from 'aedes';
import { createServer as createMqttServer } from 'net';
import { Duplex } from 'stream';

const websocketStream: (socket: WebSocket) => Duplex = require('websocket-stream');

const logWithTimestamp = (...messages: (string | unknown)[]): void => {
    console.log(`[${new Date().toISOString()}]`, ...messages);
};

const IS_PROD = process.env.NODE_ENV === 'production';
const wsPort = Number(process.env.PORT || (IS_PROD ? 3000 : 8085));
const mqttPort = Number(process.env.MQTT_PORT || 1883);

// ── Express ──────────────────────────────────────────────────────────
const app = express();
app.use(express.static('public'));

// ── MQTT Broker (aedes) ─────────────────────────────────────────────
const mqttBroker: any = new aedes();
const mqttTcpServer = createMqttServer(mqttBroker.handle.bind(mqttBroker));

// ── HTTP(S) servers ─────────────────────────────────────────────────
let secureServer: https.Server | null = null;
if (process.env.ENABLE_SSL === 'true') {
    secureServer = https.createServer({
        cert: fs.readFileSync('/etc/letsencrypt/live/autoponico-ws.tucanorobotics.co/fullchain.pem'),
        key: fs.readFileSync('/etc/letsencrypt/live/autoponico-ws.tucanorobotics.co/privkey.pem'),
    });
}

const server = http.createServer(app);

// ── WebSocket servers (noServer mode for path-based routing) ────────
const wss = new WebSocketServer({ noServer: true });
const mqttWss = new WebSocketServer({ noServer: true });

mqttWss.on('connection', (ws: WebSocket) => {
    const stream = websocketStream(ws);
    mqttBroker.handle(stream);
});

const handleUpgrade = (request: IncomingMessage, socket: Duplex, head: Buffer) => {
    const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);

    if (url.pathname === '/mqtt') {
        mqttWss.handleUpgrade(request, socket, head, (ws) => {
            mqttWss.emit('connection', ws, request);
        });
    } else {
        wss.handleUpgrade(request, socket, head, (ws) => {
            wss.emit('connection', ws, request);
        });
    }
};

server.on('upgrade', handleUpgrade);
secureServer?.on('upgrade', handleUpgrade);

// ── WS channel forwarding (ESP32 + Web UI) ──────────────────────────
const channelSockets = new Map<string, Set<WebSocket>>();

const addSocketToChannel = (channel: string, socket: WebSocket): void => {
    const sockets = channelSockets.get(channel) || new Set<WebSocket>();
    sockets.add(socket);
    channelSockets.set(channel, sockets);
};

const removeSocketFromChannel = (channel: string, socket: WebSocket): void => {
    const sockets = channelSockets.get(channel);
    if (!sockets) return;

    sockets.delete(socket);
    if (!sockets.size) channelSockets.delete(channel);
};

wss.on('connection', (socket: WebSocket, request: IncomingMessage) => {
    const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
    const channel = url.searchParams.get('channel');
    const label = url.searchParams.get('label');

    if (!channel) {
        logWithTimestamp('Rejected socket without channel', request.url || '<unknown>');
        socket.close(1008, 'channel required');
        return;
    }

    addSocketToChannel(channel, socket);
    logWithTimestamp(`Socket connected: channel=${channel}, label=${label || '<anon>'}`);

    socket.on('message', (data: RawData) => {
        const message = data.toString();
        logWithTimestamp(`[${channel}] ${label || '<anon>'} sent: ${message}`);

        channelSockets.get(channel)?.forEach((peer) => {
            if (peer !== socket && peer.readyState === WebSocket.OPEN) {
                peer.send(message);
            }
        });
    });

    socket.on('close', () => {
        removeSocketFromChannel(channel, socket);
        logWithTimestamp(`Socket disconnected: channel=${channel}, label=${label || '<anon>'}`);
    });

    socket.on('error', (error: Error) => {
        logWithTimestamp('WebSocket error', error);
    });
});

// ── MQTT broker logging ─────────────────────────────────────────────
mqttBroker.on('client', (client: any) => {
    logWithTimestamp(`MQTT client connected: ${client?.id || '<unknown>'}`);
});

mqttBroker.on('clientDisconnect', (client: any) => {
    logWithTimestamp(`MQTT client disconnected: ${client?.id || '<unknown>'}`);
});

mqttBroker.on('publish', (packet: any, client: any) => {
    if (client) {
        const topic = packet?.topic;
        const payload = packet?.payload?.toString?.() || '';
        logWithTimestamp(`MQTT message from ${client.id}: topic=${topic}, payload=${payload}`);
    }
});

mqttBroker.on('subscribe', (subscriptions: any[], client: any) => {
    const topics = subscriptions.map((s) => s.topic).join(', ');
    logWithTimestamp(`MQTT client ${client?.id || '<unknown>'} subscribed to ${topics}`);
});

// ── Start servers ───────────────────────────────────────────────────
logWithTimestamp(`Working on ${IS_PROD ? 'PROD' : 'DEV'}, WS port: ${wsPort}, MQTT TCP port: ${mqttPort}`);

server.listen(wsPort, () => {
    logWithTimestamp(`HTTP + WS + MQTT-over-WS server listening on port ${wsPort}`);
});

mqttTcpServer.listen(mqttPort, () => {
    logWithTimestamp(`MQTT TCP server listening on port ${mqttPort}`);
});

secureServer?.listen(443, () => {
    logWithTimestamp('Secure server listening on port 443');
});
