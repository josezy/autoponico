// Importing the required modules
import WebSocketServer from 'ws';

// Creating a new websocket server
const wss = new WebSocketServer.Server({ port: 8080 })
 
// Creating connection using websocket
wss.on("connection", (ws: WebSocketServer) => {
    console.log("new client connected");
 
    // sending message to client
    ws.send('Welcome, you are connected!');
 
    //on message from client
    ws.on("message", (data: WebSocketServer.RawData) => {
        console.log(`Client has sent us: ${data}`)
        ws.send(`You have sent: ${data}`)
    });
 
    // handling what to do when clients disconnects from server
    ws.on("close", () => {
        console.log("the client has connected");
    });
    // handling client connection error
    ws.onerror = function () {
        console.log("Some Error occurred")
    }
});
console.log("The WebSocket server is running on port 8080");
