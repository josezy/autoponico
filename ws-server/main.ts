// Importing the required modules
import { IncomingMessage } from 'http';
import WebSocketServer from 'ws';

// Creating a new websocket server
const wss = new WebSocketServer.Server({
    port: 8080,
})
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
console.log("The WebSocket server is running on port 8080");
