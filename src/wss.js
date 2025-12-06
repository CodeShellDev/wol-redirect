const WebSocket = require("ws")
const { v4: uuidv4 } = require("uuid")

const clients = {}

let wss = null

function attach(server, app, router) {
	wss = new WebSocket.Server({ server })

	wss.on("connection", (socket, req) => {
		const url = new URL(req.url)
		const requestId = url.searchParams.get("requestId")

		if (!requestId) {
			socket.send(JSON.stringify({ error: true, message: "Missing requestId" }))
			socket.close()
			return
		}

		clients[requestId] = socket

		socket.on("close", () => {
			delete clients[requestId]
		})
	})

	app.use("/", router)
}

function getClient(requestId) {
	return clients[requestId]
}

function createRequestId() {
	return uuidv4()
}

module.exports = { attach, getClient, createRequestId }
