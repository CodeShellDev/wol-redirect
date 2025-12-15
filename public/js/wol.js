export async function startWoLProcess({
	endpoint = "/start",
	onwsopen = () => {
		outputHandler("WebSocket connected")
	},
	onwserror = (err) => {
		outputHandler("WebSocket connection failed")
		errorHandler()
	},
	onwsclose = (success) => {
		if (success) {
			outputHandler("WebSocket closed")
		} else {
			outputHandler("WebSocket closed unexpectedly")
			errorHandler("Process ended early")
		}
	},
	onerror = (ws, msg) => {
		outputHandler("Failed to start service")
		ws.close()
		errorHandler(msg.message)
	},
	onmessage = (ws, msg) => {
		outputHandler(msg.message)
	},
	onsuccess = (ws, msg) => {
		outputHandler("Service is online! Redirecting...")
		ws.close()
		window.location.href = msg.url
	},
	errorHandler = (msg) => {
		console.error(msg)
	},
	outputHandler = (msg) => {
		console.log(msg)
	},
}) {
	try {
		const response = await fetch(endpoint)
		if (!response.ok) throw new Error(`HTTP error ${response.status}`)

		const data = await response.json()
		const clientID = data.client_id
		if (!clientID) throw new Error("No client_id returned from server")

		outputHandler("Process started. Waiting for service...")

		const protocol = location.protocol === "https:" ? "wss" : "ws"
		const ws = new WebSocket(
			`${protocol}://${location.host}/ws?client_id=${clientID}`
		)

		let success = false

		ws.onopen = onwsopen

		ws.onmessage = (event) => {
			const msg = JSON.parse(event.data)

			if (msg.message) {
				onmessage(ws, msg)
			}

			if (!msg.error && msg.url) {
				success = true
				onsuccess(ws, msg)
			}

			if (msg.error) {
				onerror(ws, msg)
			}
		}

		ws.onerror = onwserror

		ws.onclose = () => {
			onwsclose(success)
		}
	} catch (err) {
		outputHandler(`Failed to start process: ${err.message}`)
		errorHandler(err.message)
	}
}
