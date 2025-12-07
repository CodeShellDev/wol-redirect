const WebSocket = require("ws")
const { v4: uuidv4 } = require("uuid")

const clients = {}

let wss = null

function attach(server, app, router) {
	wss = new WebSocket.Server({ server })

	wss.on("connection", (socket, req) => {
		const url = new URL(req.url, "http://localhost")
		const clientID = url.searchParams.get("client_id")

		if (!clientID) {
			socket.send(JSON.stringify({ error: true, message: "Missing client_id" }))
			socket.close()
			return
		}

		clients[clientID] = socket

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

function getClient(clientID) {
	return clients[clientID]
}

function createClientID() {
	return uuidv4()
}

module.exports = { attach, getClient, createClientID }
