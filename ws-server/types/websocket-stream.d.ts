declare module 'websocket-stream' {
    import WebSocket from 'ws';
    import { Duplex } from 'stream';

    export default function websocketStream(socket: WebSocket): Duplex;
}