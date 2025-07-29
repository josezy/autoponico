import crypto from 'crypto';

export const clientId = process.env.TUYA_CLIENT_ID!;
export const clientSecret = process.env.TUYA_CLIENT_SECRET!;
export const apiBaseUrl = process.env.TUYA_API_URL!;

// Device configuration
export const DEVICES = {
  fresas: 'eb1d005863986e4722kijt',
  'valvula-tanque': 'eb07e202668d3484fex0q1',
  'luz-cannabis': 'ebc53a29ba4ed0d35btbig',
  'main-pump': 'ebd37d04f46a32e55chx6g'
} as const;

export type DeviceKey = keyof typeof DEVICES;

// Token cache
interface TokenCache {
  token: string;
  expiresAt: number;
}

let tokenCache: TokenCache | null = null;

// --- Tuya API Helper Functions ---

export function generateSignature(
  timestamp: string,
  method: string,
  url: string,
  body: string | null = null,
  accessToken: string | null = null
): string {
  const stringToSign = `${clientId}${accessToken || ''}${timestamp}${method}
${crypto.createHash('sha256').update(body || '').digest('hex').toLowerCase()}

${url}`;
  const sign = crypto.createHmac('sha256', clientSecret)
    .update(stringToSign)
    .digest('hex')
    .toUpperCase();
  return sign;
}

export async function getAccessToken(): Promise<string | null> {
  // Check if we have a valid cached token
  if (tokenCache && Date.now() < tokenCache.expiresAt) {
    return tokenCache.token;
  }

  const method = 'GET';
  const url = '/v1.0/token?grant_type=1';
  const timestamp = Date.now().toString();
  const sign = generateSignature(timestamp, method, url);

  const headers = {
    'client_id': clientId,
    'sign': sign,
    't': timestamp,
    'sign_method': 'HMAC-SHA256',
    'Content-Type': 'application/json'
  };

  try {
    const response = await fetch(`${apiBaseUrl}${url}`, { method, headers });
    const data = await response.json();

    if (data.success) {
      const token = data.result.access_token;
      const expiresIn = data.result.expire_time || 7200; // Default to 2 hours if not provided
      
      // Cache the token with expiry time (subtract 60 seconds for safety margin)
      tokenCache = {
        token,
        expiresAt: Date.now() + (expiresIn - 60) * 1000
      };
      
      return token;
    } else {
      console.error('Error getting Tuya access token:', data);
      return null;
    }
  } catch (error) {
    console.error('Failed to fetch Tuya access token:', error);
    return null;
  }
}

// Function to get device status
// Reference: https://developer.tuya.com/en/docs/iot/open-api/api-reference/smart-home-devices-management/device-status?id=K9gf7o5prgf7s
export async function getDeviceStatus(targetDeviceId: string): Promise<any> {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    throw new Error('Failed to get access token');
  }

  const method = 'GET';
  const url = `/v1.0/devices/${targetDeviceId}/status`;
  const timestamp = Date.now().toString();
  const sign = generateSignature(timestamp, method, url, null, accessToken); // No body for GET

  const headers = {
    'client_id': clientId,
    'access_token': accessToken,
    'sign': sign,
    't': timestamp,
    'sign_method': 'HMAC-SHA256',
    'Content-Type': 'application/json'
  };

  try {
    const response = await fetch(`${apiBaseUrl}${url}`, { method, headers });
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Failed to fetch Tuya device status:', error);
    throw new Error('Failed to fetch status');
  }
}

// Function to send device commands
// Reference: https://developer.tuya.com/en/docs/iot/open-api/api-reference/smart-home-devices-management/device-control?id=K9gchzlskph3v
export async function sendDeviceCommand(
  targetDeviceId: string,
  commands: { code: string; value: any }[]
): Promise<any> {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    throw new Error("Failed to get access token");
  }

  const method = "POST";
  const url = `/v1.0/devices/${targetDeviceId}/commands`;
  const timestamp = Date.now().toString();
  const body = JSON.stringify({ commands });
  const sign = generateSignature(timestamp, method, url, body, accessToken);

  const headers = {
    client_id: clientId,
    access_token: accessToken,
    sign: sign,
    t: timestamp,
    sign_method: "HMAC-SHA256",
    "Content-Type": "application/json",
  };

  try {
    const response = await fetch(`${apiBaseUrl}${url}`, {
      method,
      headers,
      body,
    });
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Failed to send Tuya device command:", error);
    throw new Error("Failed to send command");
  }
}

// Helper functions for device management
export function getDeviceId(deviceKey: DeviceKey): string {
  return DEVICES[deviceKey];
}

export function getDeviceName(deviceKey: DeviceKey): string {
  return deviceKey.charAt(0).toUpperCase() + deviceKey.slice(1).replace('-', ' ');
}

export function getAllDevices(): Array<{ key: DeviceKey; id: string; name: string }> {
  return Object.keys(DEVICES).map(key => ({
    key: key as DeviceKey,
    id: DEVICES[key as DeviceKey],
    name: getDeviceName(key as DeviceKey)
  }));
}

// Countdown functionality
export async function setDeviceCountdown(
  deviceKey: DeviceKey,
  action: 'on' | 'off',
  countdown: number
): Promise<any> {
  const deviceId = getDeviceId(deviceKey);
  const commands = [
    { code: "switch_1", value: action === 'on' },
    { code: "countdown_1", value: countdown }
  ];

  return await sendDeviceCommand(deviceId, commands);
}

// Batch status functionality
export async function getAllDeviceStatuses(): Promise<Array<{
  key: DeviceKey;
  id: string;
  name: string;
  status: boolean | null;
  connected: boolean;
  error?: string;
}>> {
  const devices = getAllDevices();

  const statusPromises = devices.map(async (device) => {
    try {
      const result = await getDeviceStatus(device.id);

      if (result.success && result.result) {
        const switchStatus = result.result.find(
          (status: { code: string; value: any }) => status.code === "switch_1"
        );

        return {
          key: device.key,
          id: device.id,
          name: device.name,
          status: switchStatus ? switchStatus.value : null,
          connected: true
        };
      } else {
        return {
          key: device.key,
          id: device.id,
          name: device.name,
          status: null,
          connected: false,
          error: result.msg || "Unknown Tuya error"
        };
      }
    } catch (error: any) {
      return {
        key: device.key,
        id: device.id,
        name: device.name,
        status: null,
        connected: false,
        error: error.message || "Connection error"
      };
    }
  });

  return await Promise.all(statusPromises);
}
