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
logWithTimestamp("Working on", IS_PROD ? "PROD" : "DEV");

const port = IS_PROD ? 80 : 8085;

const app = express();
app.use(express.static('public'))

let secureServer: https.Server | null = null;
if (IS_PROD) {
    secureServer = https.createServer({
        cert: fs.readFileSync('/etc/letsencrypt/live/autoponico-ws.tucanorobotics.co/fullchain.pem'),
        key: fs.readFileSync('/etc/letsencrypt/live/autoponico-ws.tucanorobotics.co/privkey.pem'),
    });
}

const server = http.createServer(app);

// Upgrade to websocket server
const wss = new WebSocketServer.Server({ server: secureServer || server });
const clients = new Set<WebSocketServer>();

// Creating connection using websocket
wss.on("connection", (ws: WebSocketServer, req: IncomingMessage) => {
    logWithTimestamp("new socket connected: ", req.url);
    clients.add(ws);

    // sending message to client
    ws.send('Welcome, you are connected!');

    //on message from client
    ws.on("message", (data: WebSocketServer.RawData) => {
        logWithTimestamp(`Client has sent us: ${data}`)
        clients.forEach(client => {
            if (client !== ws) {
                client.send(data.toString());
            }
        });
    });

    // handling what to do when clients disconnects from server
    ws.on("close", () => {
        logWithTimestamp("the client has disconnected", req.url);
        clients.delete(ws);
    });
    // handling client connection error
    ws.onerror = function (e) {
        logWithTimestamp("Some Error occurred", e);
    }
});

server.listen(port);
secureServer?.listen(443);
