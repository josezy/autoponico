import { IncomingMessage } from 'http';
import WebSocketServer from 'ws';
import https from 'https';
import http from 'http';
import fs from 'fs';

const IS_PROD = process.env.NODE_ENV === 'production';
console.log("Working on", IS_PROD ? "PROD" : "DEV");

const port = IS_PROD ? 443 : 8085;

// Creating a new websocket server
let server: https.Server | http.Server;
if (IS_PROD) {
    server = https.createServer({
        cert: fs.readFileSync('./certificates/cert.pem'),
        key: fs.readFileSync('./certificates/cert-key.pem'),
    });
} else {
    server = http.createServer({});
}

const wss = new WebSocketServer.Server({ server });
const clients = new Set<WebSocketServer>();

// Creating connection using websocket
wss.on("connection", (ws: WebSocketServer, req: IncomingMessage) => {
    console.log("new socket connected: ", req.url);
    clients.add(ws);

    // sending message to client
    ws.send('Welcome, you are connected!');

    //on message from client
    ws.on("message", (data: WebSocketServer.RawData) => {
        console.log(`Client has sent us: ${data}`)
        clients.forEach(client => {
            if (client !== ws) {
                client.send(data.toString());
            }
        });
    });

    // handling what to do when clients disconnects from server
    ws.on("close", () => {
        console.log("the client has disconnected");
        clients.delete(ws);
    });
    // handling client connection error
    ws.onerror = function () {
        console.log("Some Error occurred")
    }
});

server.listen(port);
