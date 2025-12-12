import { WebSocketServer } from "ws"
import { v4 as uuidv4 } from "uuid"

const waiters = new Map()
const clients = {}

let wss = null

export function Attach(server, app, router) {
	wss = new WebSocketServer({ server })

	wss.on("connection", (socket, req) => {
		const url = new URL(req.url, "http://localhost")
		const clientID = url.searchParams.get("client_id")

		if (!clientID) {
			socket.send(JSON.stringify({ error: true, message: "Missing client_id" }))
			socket.close()
			return
		}

		clients[clientID] = socket

		if (waiters.has(clientID)) {
			waiters.get(clientID)(socket)
			waiters.delete(clientID)
		}

		socket.isAlive = true

		socket.on("pong", () => {
			socket.isAlive = true
		})

		const interval = setInterval(() => {
			if (socket.isAlive === false) {
				socket.terminate()
				return
			}
			socket.isAlive = false
			socket.ping()
		}, 15000)

		socket.on("close", () => {
			clearInterval(interval)
			delete clients[clientID]
		})
	})

	app.use("/", router)
}

export function WaitForClient(clientID, timeout = 5000) {
	return new Promise((resolve, reject) => {
		const existing = clients[clientID]
		if (existing) return resolve(existing)

		waiters.set(clientID, resolve)

		setTimeout(() => {
			if (waiters.has(clientID)) {
				waiters.delete(clientID)
				reject(new Error("WebSocket connection timeout"))
			}
		}, timeout)
	})
}

export function GetClient(clientID) {
	return clients[clientID]
}

export function CreateClientID() {
	return uuidv4()
}
