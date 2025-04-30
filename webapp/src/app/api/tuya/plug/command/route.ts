import { NextRequest, NextResponse } from "next/server";
import { deviceId, sendDeviceCommand } from "@/lib/tuya-api"; // Adjust path as needed

// --- API Route Handler ---

export async function POST(request: NextRequest) {
  if (!deviceId) {
    return NextResponse.json(
      {
        success: false,
        message: "TUYA_DEVICE_ID is not configured on the server.",
      },
      { status: 500 }
    );
  }

  let commandValue: boolean;

  try {
    const body = await request.json();
    const action = body.action; // Expecting 'on' or 'off'

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

    // Assuming the smart plug's switch is controlled by the code 'switch_1'
    const commands = [{ code: "switch_1", value: commandValue }];

    const result = await sendDeviceCommand(deviceId, commands);

    if (result.success) {
      console.log(result)
      return NextResponse.json({
        success: true,
        message: `Device ${deviceId} turned ${action}`,
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
