'use client'

import React from "react"

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <WebsocketCommander />
      <Footer />
    </main>
  )
}

const Footer = () => (
  <div className="mb-32 grid text-center lg:max-w-5xl lg:w-full lg:mb-0 lg:grid-cols-4 lg:text-left">      
  </div>
)

const WebsocketCommander = () => {
  const [ws, setWs] = React.useState<WebSocket | null>(null)
  const [messages, setMessages] = React.useState<string[]>([])
  const [message, setMessage] = React.useState<string>("")
  const [isConnected, setIsConnected] = React.useState<boolean>(false)

  const connect = () => {
    const ws = new WebSocket("ws://localhost:8085/ws?id=webapp")
    ws.onopen = () => {
      setIsConnected(true)
    }
    ws.onmessage = (event) => {
      setMessages((messages) => [...messages, event.data])
    }
    ws.onclose = () => {
      setIsConnected(false)
    }
    setWs(ws)
  }

  const disconnect = () => {
    ws?.close()
  }

  const send = () => {
    ws?.send(message)
    setMessage("")
  }

  return (
    <div className="flex flex-col items-center justify-center w-full">
      <div className="flex flex-row items-center justify-center w-full mb-3">
        <button
          className="px-4 py-2 mr-2 text-white bg-blue-500 rounded-md"
          onClick={connect}
          disabled={isConnected}
        >
          Connect
        </button>
        <button
          className="px-4 py-2 mr-2 text-white bg-red-500 rounded-md"
          onClick={disconnect}
          disabled={!isConnected}
        >
          Disconnect
        </button>
      </div>
      <div className="flex flex-row items-center justify-center w-full">
        <input
          className="w-full px-4 py-2 mr-2 text-black bg-white border rounded-md"
          type="text"
          placeholder="Message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          disabled={!isConnected}
        />
        <button
          className="px-4 py-2 mr-2 text-white bg-green-500 rounded-md"
          onClick={send}
          disabled={!isConnected}
        >
          Send
        </button>
      </div>
      <div className="flex flex-col items-center justify-center w-full mt-3">
        <div className="flex flex-col items-center justify-center w-full">
          <span className="text-xl font-bold">Messages</span>
        </div>
        <div className="flex flex-col items-center justify-center w-full mt-3">
          {messages.map((message, index) => (
            <span key={index} className="text-lg">
              {message}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
