import { IncomingMessage } from 'http';
import WebSocketServer from 'ws';
import https from 'https';
import http from 'http';
import fs from 'fs';
import express from 'express';

const logWithTimestamp = (...messages: (string | any)[]): void => {
    console.log(`[${new Date().toISOString()}]`, ...messages)
}

const IS_PROD = process.env.NODE_ENV === 'production';
const port = IS_PROD ? 3000 : 8085;
logWithTimestamp(`Working on ${IS_PROD ? "PROD" : "DEV"}, port: ${port}`);

const app = express();
app.use(express.static('public'))

let secureServer: https.Server | null = null;
if (process.env.ENABLE_SSL === 'true') {
    secureServer = https.createServer({
        cert: fs.readFileSync('/etc/letsencrypt/live/autoponico-ws.tucanorobotics.co/fullchain.pem'),
        key: fs.readFileSync('/etc/letsencrypt/live/autoponico-ws.tucanorobotics.co/privkey.pem'),
    });
}

const server = http.createServer(app);

// Upgrade to websocket server
const wss = new WebSocketServer.Server({ server: secureServer || server });
const channels = new Map<string, Set<WebSocketServer>>();

// Creating connection using websocket
wss.on("connection", (ws: WebSocketServer, req: IncomingMessage) => {
    logWithTimestamp(`new socket: ${req.url}`);
    const url = new URL(req.url || "", `http://${req.headers.host}`);
    const channel = url.searchParams.get("channel");
    const label = url.searchParams.get("label");

    if (!channel) {
        logWithTimestamp("channel not found");
        ws.close();
        return;
    }

    // TODO: check authentication?

    if (!channels.has(channel)) {
        logWithTimestamp(`set new channel: ${channel}`);
        channels.set(channel, new Set<WebSocketServer>([ws]));
    } else {
        channels.get(channel)?.add(ws);
    }

    // sending message to client
    ws.send('Welcome, you are connected!');

    //on message from client
    ws.on("message", (data: WebSocketServer.RawData) => {
        logWithTimestamp(`[${channel}] ${label || "<anon>"} sent: ${data}`)
        channels.get(channel)?.forEach((client) => {
            if (client !== ws) {
                client.send(data.toString());
            }
        });
    });

    // handling what to do when clients disconnects from server
    ws.on("close", () => {
        logWithTimestamp(`socket disconnected: ${req.url}`);
        channels.get(channel)?.delete(ws);
    });

    // handling client connection error
    ws.onerror = function (e) {
        logWithTimestamp("Some Error occurred", e);
    }
});

server.listen(port);
secureServer?.listen(443);
