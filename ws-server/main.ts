import { IncomingMessage } from 'http';
import WebSocket, { RawData, WebSocketServer } from 'ws';
import https from 'https';
import http from 'http';
import fs from 'fs';
import express from 'express';
import aedes from 'aedes';
import { createServer as createMqttServer } from 'net';

const websocketStream: (socket: WebSocket) => NodeJS.ReadWriteStream = require('websocket-stream');

const logWithTimestamp = (...messages: (string | unknown)[]): void => {
    console.log(`[${new Date().toISOString()}]`, ...messages);
};

const IS_PROD = process.env.NODE_ENV === 'production';
const wsPort = Number(process.env.PORT || (IS_PROD ? 3000 : 8085));
const mqttPort = Number(process.env.MQTT_PORT || 1883);
const mqttWsPort = Number(process.env.MQTT_WS_PORT || (IS_PROD ? 8883 : 8086));

type ClientRole = 'dashboard' | 'legacy-device';
type DeviceKey = 'fresas' | 'valvula-tanque' | 'luz-cannabis' | 'main-pump';
type DevicePower = 'ON' | 'OFF' | 'UNKNOWN';

interface DeviceConfig {
    key: DeviceKey;
    name: string;
    topic: string;
}

interface DeviceState {
    deviceKey: DeviceKey;
    name: string;
    topic: string;
    power: DevicePower;
    connected: boolean;
    lastSeen: string | null;
    source: 'mqtt' | 'server';
}

interface SocketMetadata {
    role: ClientRole;
    channel: string | null;
    label: string | null;
    connectedAt: string;
}

interface DeviceCommandMessage {
    type: 'device-command';
    deviceKey: string;
    action: string;
}

interface DeviceSyncRequestMessage {
    type: 'device-sync-request';
}

type DashboardMessage = DeviceCommandMessage | DeviceSyncRequestMessage;

const DEVICE_CONFIGS: Record<DeviceKey, DeviceConfig> = {
    fresas: { key: 'fresas', name: 'Fresas', topic: 'fresas' },
    'valvula-tanque': { key: 'valvula-tanque', name: 'Valvula Tanque', topic: 'valvula-tanque' },
    'luz-cannabis': { key: 'luz-cannabis', name: 'Luz Cannabis', topic: 'luz-cannabis' },
    'main-pump': { key: 'main-pump', name: 'Main Pump', topic: 'main-pump' },
};

const deviceStates = new Map<DeviceKey, DeviceState>(
    Object.values(DEVICE_CONFIGS).map((device) => [
        device.key,
        {
            deviceKey: device.key,
            name: device.name,
            topic: device.topic,
            power: 'UNKNOWN',
            connected: false,
            lastSeen: null,
            source: 'server',
        },
    ]),
);

const dashboards = new Set<WebSocket>();
const channelSockets = new Map<string, Set<WebSocket>>();
const socketMetadata = new Map<WebSocket, SocketMetadata>();

const app = express();
app.use(express.static('public'));

const mqttBroker: any = new aedes();
const mqttServer = createMqttServer(mqttBroker.handle.bind(mqttBroker));

const mqttWsServer = http.createServer();
const mqttWss = new WebSocketServer({ server: mqttWsServer });
mqttWss.on('connection', (ws: WebSocket) => {
    const stream = websocketStream(ws);
    mqttBroker.handle(stream);
});

let secureServer: https.Server | null = null;
if (process.env.ENABLE_SSL === 'true') {
    secureServer = https.createServer({
        cert: fs.readFileSync('/etc/letsencrypt/live/autoponico-ws.tucanorobotics.co/fullchain.pem'),
        key: fs.readFileSync('/etc/letsencrypt/live/autoponico-ws.tucanorobotics.co/privkey.pem'),
    });
}

const server = http.createServer(app);
const wss = new WebSocketServer({ server: secureServer || server });

const isSocketOpen = (socket: WebSocket): boolean => socket.readyState === WebSocket.OPEN;

const sendJson = (socket: WebSocket, payload: unknown): void => {
    if (!isSocketOpen(socket)) {
        return;
    }

    socket.send(JSON.stringify(payload));
};

const getDeviceSnapshot = (): DeviceState[] => Array.from(deviceStates.values());

const sendDeviceSnapshot = (socket: WebSocket): void => {
    sendJson(socket, {
        type: 'device-snapshot',
        devices: getDeviceSnapshot(),
    });
};

const broadcastToDashboards = (payload: unknown): void => {
    dashboards.forEach((socket) => {
        sendJson(socket, payload);
    });
};

const sendDeviceError = (
    socket: WebSocket,
    code: string,
    message: string,
    details?: Record<string, unknown>,
): void => {
    sendJson(socket, {
        type: 'device-error',
        code,
        message,
        ...(details || {}),
    });
};

const addSocketToChannel = (channel: string, socket: WebSocket): void => {
    const sockets = channelSockets.get(channel) || new Set<WebSocket>();
    sockets.add(socket);
    channelSockets.set(channel, sockets);
};

const removeSocketFromChannel = (channel: string, socket: WebSocket): void => {
    const sockets = channelSockets.get(channel);
    if (!sockets) {
        return;
    }

    sockets.delete(socket);
    if (!sockets.size) {
        channelSockets.delete(channel);
    }
};

const normalizePower = (rawValue: unknown): DevicePower => {
    if (typeof rawValue === 'boolean') {
        return rawValue ? 'ON' : 'OFF';
    }

    if (typeof rawValue !== 'string') {
        return 'UNKNOWN';
    }

    const normalized = rawValue.trim().toUpperCase();
    if (normalized === 'ON' || normalized === 'OFF') {
        return normalized;
    }

    return 'UNKNOWN';
};

const updateDeviceState = (
    deviceKey: DeviceKey,
    partialState: Partial<Omit<DeviceState, 'deviceKey' | 'name' | 'topic'>>,
): DeviceState => {
    const currentState = deviceStates.get(deviceKey);
    if (!currentState) {
        throw new Error(`Unknown device key: ${deviceKey}`);
    }

    const nextState: DeviceState = {
        ...currentState,
        ...partialState,
        lastSeen: partialState.lastSeen ?? new Date().toISOString(),
    };

    deviceStates.set(deviceKey, nextState);
    return nextState;
};

const publishDeviceState = (deviceState: DeviceState): void => {
    broadcastToDashboards({
        type: 'device-state',
        ...deviceState,
    });
};

const findDeviceByTopic = (topic: string): DeviceState | undefined => {
    return getDeviceSnapshot().find((device) => device.topic === topic);
};

const extractPowerFromJsonPayload = (payloadText: string): DevicePower => {
    try {
        const parsed = JSON.parse(payloadText);
        return normalizePower(parsed.POWER ?? parsed.POWER1 ?? parsed.Power ?? parsed.power);
    } catch {
        return 'UNKNOWN';
    }
};

const handleMqttPublication = (topic: string, payloadText: string): void => {
    const segments = topic.split('/');
    if (segments.length < 3) {
        return;
    }

    const prefix = segments[0];
    const device = findDeviceByTopic(segments[1]);
    if (!device) {
        return;
    }

    const leaf = segments[2];

    if (prefix === 'tele' && leaf === 'LWT') {
        const connected = payloadText.trim().toLowerCase() === 'online';
        const nextState = updateDeviceState(device.deviceKey, {
            connected,
            source: 'mqtt',
        });
        publishDeviceState(nextState);
        return;
    }

    if (prefix === 'tele' && leaf === 'STATE') {
        const power = extractPowerFromJsonPayload(payloadText);
        const nextState = updateDeviceState(device.deviceKey, {
            connected: true,
            power: power === 'UNKNOWN' ? device.power : power,
            source: 'mqtt',
        });
        publishDeviceState(nextState);
        return;
    }

    if (prefix === 'stat' && leaf === 'POWER') {
        const nextState = updateDeviceState(device.deviceKey, {
            connected: true,
            power: normalizePower(payloadText),
            source: 'mqtt',
        });
        publishDeviceState(nextState);
        return;
    }

    if (prefix === 'stat' && leaf === 'RESULT') {
        const power = extractPowerFromJsonPayload(payloadText);
        if (power === 'UNKNOWN') {
            return;
        }

        const nextState = updateDeviceState(device.deviceKey, {
            connected: true,
            power,
            source: 'mqtt',
        });
        publishDeviceState(nextState);
    }
};

const isDashboardMessage = (value: unknown): value is DashboardMessage => {
    return !!value && typeof value === 'object' && typeof (value as { type?: unknown }).type === 'string';
};

const queueDeviceCommand = (socket: WebSocket, message: DeviceCommandMessage): void => {
    const config = DEVICE_CONFIGS[message.deviceKey as DeviceKey];
    if (!config) {
        sendDeviceError(socket, 'unknown-device', 'Unknown device key', { deviceKey: message.deviceKey });
        return;
    }

    const action = message.action.trim().toUpperCase();
    if (!['ON', 'OFF', 'TOGGLE'].includes(action)) {
        sendDeviceError(socket, 'invalid-action', 'Unsupported device action', {
            action: message.action,
            deviceKey: message.deviceKey,
        });
        return;
    }

    const currentState = deviceStates.get(config.key);
    if (!currentState?.connected) {
        sendDeviceError(socket, 'device-offline', 'Target device is offline', {
            deviceKey: message.deviceKey,
            topic: config.topic,
        });
        return;
    }

    const topic = `cmnd/${config.topic}/POWER`;
    mqttBroker.publish(
        {
            topic,
            payload: action,
            qos: 0,
            retain: false,
        },
        (error?: Error) => {
            if (error) {
                logWithTimestamp('Failed to publish MQTT command', error);
                sendDeviceError(socket, 'mqtt-publish-failed', 'Failed to publish MQTT command', {
                    deviceKey: message.deviceKey,
                    topic,
                });
                return;
            }

            sendJson(socket, {
                type: 'device-command-queued',
                deviceKey: config.key,
                action,
                topic,
                queuedAt: new Date().toISOString(),
            });
        },
    );
};

const handleDashboardMessage = (socket: WebSocket, rawMessage: string): boolean => {
    let parsedMessage: unknown;
    try {
        parsedMessage = JSON.parse(rawMessage);
    } catch {
        return false;
    }

    if (!isDashboardMessage(parsedMessage)) {
        return false;
    }

    if (parsedMessage.type === 'device-sync-request') {
        sendDeviceSnapshot(socket);
        return true;
    }

    if (parsedMessage.type === 'device-command') {
        queueDeviceCommand(socket, parsedMessage);
        return true;
    }

    return false;
};

const forwardLegacyMessage = (sourceSocket: WebSocket, channel: string, rawMessage: string): void => {
    const channelPeers = channelSockets.get(channel);
    if (!channelPeers) {
        return;
    }

    channelPeers.forEach((peer) => {
        if (peer !== sourceSocket && isSocketOpen(peer)) {
            peer.send(rawMessage);
        }
    });
};

const handleSocketMessage = (socket: WebSocket, data: RawData): void => {
    const metadata = socketMetadata.get(socket);
    if (!metadata) {
        return;
    }

    const rawMessage = data.toString();
    if (metadata.role === 'dashboard' && handleDashboardMessage(socket, rawMessage)) {
        return;
    }

    if (!metadata.channel) {
        sendDeviceError(socket, 'missing-channel', 'Legacy message rejected because no channel was provided');
        return;
    }

    logWithTimestamp(`[${metadata.channel}] ${metadata.label || '<anon>'} sent: ${rawMessage}`);
    forwardLegacyMessage(socket, metadata.channel, rawMessage);
};

logWithTimestamp(
    `Working on ${IS_PROD ? 'PROD' : 'DEV'}, WS port: ${wsPort}, MQTT port: ${mqttPort}, MQTT WS port: ${mqttWsPort}`,
);

mqttBroker.on('client', (client: any) => {
    logWithTimestamp(`MQTT client connected: ${client?.id || '<unknown>'}`);
});

mqttBroker.on('clientDisconnect', (client: any) => {
    logWithTimestamp(`MQTT client disconnected: ${client?.id || '<unknown>'}`);
});

mqttBroker.on('publish', (packet: any, client: any) => {
    const topic = packet?.topic;
    const payloadText = packet?.payload?.toString?.() || '';

    if (client) {
        logWithTimestamp(`MQTT message from ${client.id}: topic=${topic}, payload=${payloadText}`);
    }

    if (!topic) {
        return;
    }

    handleMqttPublication(topic, payloadText);
});

mqttBroker.on('subscribe', (subscriptions: any[], client: any) => {
    const topics = subscriptions.map((subscription) => subscription.topic).join(', ');
    logWithTimestamp(`MQTT client ${client?.id || '<unknown>'} subscribed to ${topics}`);
});

wss.on('connection', (socket: WebSocket, request: IncomingMessage) => {
    const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
    const role: ClientRole = url.searchParams.get('role') === 'dashboard' ? 'dashboard' : 'legacy-device';
    const channel = url.searchParams.get('channel');
    const label = url.searchParams.get('label');

    if (role === 'legacy-device' && !channel) {
        logWithTimestamp('Rejected legacy socket without channel', request.url || '<unknown>');
        socket.close(1008, 'channel required');
        return;
    }

    socketMetadata.set(socket, {
        role,
        channel,
        label,
        connectedAt: new Date().toISOString(),
    });

    if (channel) {
        addSocketToChannel(channel, socket);
    }

    if (role === 'dashboard') {
        dashboards.add(socket);
        sendJson(socket, {
            type: 'server-ready',
            mqttPort,
            mqttWsPort,
            wsPort,
        });
        sendDeviceSnapshot(socket);
    }

    logWithTimestamp(`Socket connected: role=${role}, channel=${channel || '<none>'}, label=${label || '<anon>'}`);

    socket.on('message', (data: RawData) => {
        handleSocketMessage(socket, data);
    });

    socket.on('close', () => {
        dashboards.delete(socket);

        const metadata = socketMetadata.get(socket);
        if (metadata?.channel) {
            removeSocketFromChannel(metadata.channel, socket);
        }

        socketMetadata.delete(socket);
        logWithTimestamp(`Socket disconnected: role=${metadata?.role || 'unknown'}, channel=${metadata?.channel || '<none>'}`);
    });

    socket.on('error', (error: Error) => {
        logWithTimestamp('WebSocket error', error);
    });
});

server.listen(wsPort, () => {
    logWithTimestamp(`WebSocket server listening on port ${wsPort}`);
});

mqttServer.listen(mqttPort, () => {
    logWithTimestamp(`MQTT TCP server listening on port ${mqttPort}`);
});

mqttWsServer.listen(mqttWsPort, () => {
    logWithTimestamp(`MQTT WebSocket server listening on port ${mqttWsPort}`);
});

secureServer?.listen(443, () => {
    logWithTimestamp('Secure WebSocket server listening on port 443');
});
