import { NextRequest, NextResponse } from "next/server";
import { sendDeviceCommand, getDeviceId, DeviceKey, DEVICES } from "@/lib/tuya-api";

// --- API Route Handler ---

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { device: deviceKey, action } = body;

    if (!deviceKey || !(deviceKey in DEVICES)) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid or missing device key. Valid devices: " + Object.keys(DEVICES).join(', '),
        },
        { status: 400 }
      );
    }

    let commandValue: boolean;

    if (action === "on") {
      commandValue = true;
    } else if (action === "off") {
      commandValue = false;
    } else {
      return NextResponse.json(
        { success: false, message: "Invalid action. Use 'on' or 'off'." },
        { status: 400 }
      );
    }

    const deviceId = getDeviceId(deviceKey as DeviceKey);

    // Regular switch command
    const commands = [{ code: "switch_1", value: commandValue }];
    const result = await sendDeviceCommand(deviceId, commands);

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: `Device ${deviceKey} (${deviceId}) turned ${action}`,
        deviceKey,
        deviceId
      });
    } else {
      console.error("Tuya API command error:", result);
      return NextResponse.json(
        {
          success: false,
          message: "Failed to execute command via Tuya API",
          error: result.msg || "Unknown Tuya error",
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("API Error:", error);
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { success: false, message: "Invalid JSON body" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, message: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
