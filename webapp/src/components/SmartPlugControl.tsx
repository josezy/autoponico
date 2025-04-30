"use client";

import React, { useEffect } from "react";
import { ImSpinner9 } from "react-icons/im";
import { TbReload } from "react-icons/tb";
import { toast } from "react-toastify";

const SmartPlugControl = () => {
  const [plugStatus, setPlugStatus] = React.useState<boolean | null>(null);
  const [plugLoading, setPlugLoading] = React.useState<boolean>(true);
  const [isConnected, setIsConnected] = React.useState<boolean>(true);

  // Function to fetch plug status
  const fetchPlugStatus = async () => {
    setPlugLoading(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout

      const response = await fetch("/api/tuya/plug/status", {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const data = await response.json();
      if (data.success) {
        setPlugStatus(data.isOn);
        setIsConnected(true);
      } else {
        console.error("Failed to fetch plug status:", data.message);
        toast.error(`Failed to get plug status: ${data.message}`);
        setPlugStatus(null);
      }
    } catch (error: any) {
      console.error("Error fetching plug status:", error);
      if (error.name === "AbortError") {
        toast.error("Connection timeout. Device may be offline.");
        setIsConnected(false);
      } else {
        toast.error("Error fetching plug status.");
      }
      setPlugStatus(null);
    } finally {
      setPlugLoading(false);
    }
  };

  // Fetch initial plug status on mount
  useEffect(() => {
    fetchPlugStatus();
  }, []);

  // Function to handle plug commands
  const handlePlugCommand = async (action: "on" | "off") => {
    setPlugLoading(true);
    try {
      const response = await fetch("/api/tuya/plug/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await response.json();
      if (data.success) {
        setPlugStatus(action === "on");
        toast.success(`Plug turned ${action}.`);
        setIsConnected(true);
      } else {
        console.error(`Failed to turn plug ${action}:`, data.message);
        toast.error(`Failed to turn plug ${action}: ${data.message}`);
      }
    } catch (error) {
      console.error(`Error sending plug command ${action}:`, error);
      toast.error(`Error turning plug ${action}.`);
    } finally {
      setPlugLoading(false);
    }
  };

  return (
    <div className="bg-white shadow rounded-lg p-4 mb-4">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-xl font-semibold">Smart Plug Control</h2>
        <div className="flex items-center gap-2">
          {plugLoading && (
            <ImSpinner9 className="animate-spin text-xl text-gray-500" />
          )}
          <TbReload
            size={24}
            strokeWidth={2}
            onClick={fetchPlugStatus}
            className="text-teal-600 cursor-pointer rounded-full hover:bg-neutral-100 p-1"
            title="Refresh status"
          />
          <div
            className={`h-3 w-3 rounded-full ${
              isConnected ? "bg-green-500" : "bg-red-500"
            }`}
            title={isConnected ? "Connected" : "Disconnected"}
          ></div>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-sm font-medium">
          Status:{" "}
          {plugLoading
            ? "Loading..."
            : plugStatus === null
            ? "Unknown"
            : plugStatus
            ? "On"
            : "Off"}
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => handlePlugCommand("on")}
            className="btn"
            disabled={plugLoading || plugStatus === true}
          >
            Turn On
          </button>
          <button
            onClick={() => handlePlugCommand("off")}
            className="btn btn-danger"
            disabled={plugLoading || plugStatus === false}
          >
            Turn Off
          </button>
        </div>
      </div>
    </div>
  );
};

export default SmartPlugControl;
