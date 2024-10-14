'use client'

import React from "react"

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-1 sm:p-6 md:p-12 lg:p-16 max-w-5xl w-full mx-auto">
      <WebsocketCommander />
      <Footer />
    </main>
  )
}

const Footer = () => (
  <div className="mb-32 grid text-center lg:max-w-5xl lg:w-full lg:mb-0 lg:grid-cols-4 lg:text-left">
  </div>
)

const assembleLine = (message: string, isMe: boolean = false) => {
  return (
    <span>
      <span className="text-slate-400">[{new Date().toISOString()}]:</span> <span className="text-slate-900 dark:text-slate-100">{isMe ? "> " : ""}{message}</span>
    </span>
  )
}

const WebsocketCommander = () => {
  const [ws, setWs] = React.useState<WebSocket | null>(null)
  const [messages, setMessages] = React.useState<React.ReactNode[]>([])
  const [message, setMessage] = React.useState<string>("")
  const [isConnected, setIsConnected] = React.useState<boolean>(false)

  const bottomRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    // press enter to send message
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key === "Enter") {
        send()
      }
    }
    document.addEventListener("keydown", handleKeyPress)
    return () => {
      document.removeEventListener("keydown", handleKeyPress)
    }
  }, [message])

  React.useEffect(() => {
    if (messages.length) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages.length])

  // React.useEffect(() => {
  //   let interval: NodeJS.Timeout;
  //   if (isConnected) {
  //     interval = setInterval(() => {
  //       ws?.send("ph read_ph")
  //     }, 1000)
  //   } else {
  //     clearInterval(interval! ? interval : 0)
  //   }
  //   return () => {
  //     clearInterval(interval)
  //   }
  // }, [isConnected])

  const connect = () => {
    const ws = new WebSocket(`${process.env.NEXT_PUBLIC_WSSERVER_URL}/ws${window.location.search}`)
    ws.onopen = () => {
      setIsConnected(true)
    }
    ws.onmessage = (event) => {
      const line = assembleLine(event.data)
      setMessages((messages) => [...messages, line])
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
    const line = assembleLine(message, true)
    setMessages((messages) => [...messages, line])
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
          className="!py-2 mr-2 !rounded-md"
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
        <div className="flex gap-3 items-center justify-center w-full">
          <span className="text-xl font-bold dark:text-neutral-200">Messages</span>
          <span
            className="text-sm text-gray-500 hover:underline cursor-pointer"
            onClick={() => setMessages([])}
          >
            clear
          </span>
        </div>
        <div className="flex flex-col items-start px-5 py-2 justify-start w-full mt-3 h-96 overflow-y-auto border border-gray-300 rounded-md">
          {messages.map((message, index) => (
            <span key={index} className="text-lg break-all">
              {message}
            </span>
          ))}
          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  )
}
