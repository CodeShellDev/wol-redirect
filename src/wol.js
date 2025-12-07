const express = require("express")
const wss = require("./wss")

const WebSocket = require("ws")

const { logger } = require("./utils/logger")
const request = require("./utils/request")
const { ENV } = require("./env")
const fs = require("fs")

const router = express.Router()

const CONFIG = JSON.parse(fs.readFileSync(ENV.configPath, "utf8"))

function buildQuery(pattern, context) {
	return Object.entries(context).reduce(
		(str, [k, v]) => str.replaceAll(`{${k}}`, v),
		pattern
	)
}

function resolveRecord(hostname) {
	const { records } = CONFIG

	if (records[hostname]) return records[hostname]
	if (records.any) {
		logger.debug(`Using wildcard record`)
		return records.any
	}

	logger.warn(`No record for hostname: ${hostname}`)
	return null
}

function resolveRoute(recordName) {
	const routeObj = CONFIG.routes?.[recordName]

	if (!routeObj) {
		logger.warn(`No route for record: ${recordName}`)
		return null
	}
	if (!Array.isArray(routeObj.route)) {
		logger.warn(`Route entry missing 'route' array: ${recordName}`)
		return null
	}

	return routeObj
}

function buildHostEntry(key) {
	let host = CONFIG.hosts?.[key]

	if (!host) {
		logger.warn(`Host not found: ${key}`)

		if (!CONFIG.hosts?.any) return null

		logger.debug(`Using wildcard host`)
		host = CONFIG.hosts.any
	}

	return {
		ip: host.ip,
		mac: host.mac,
		id: host.id,
		startupTime: host.startupTime,
		isVirtual: Boolean(host.isVirtual),
	}
}

function getDataByHostname(hostname) {
	const record = resolveRecord(hostname)
	if (!record) return null

	const routeObj = resolveRoute(record)
	if (!routeObj) return null

	const hosts = routeObj.route.map(buildHostEntry).filter(Boolean)

	return {
		hosts,
		routeAttributes: routeObj.attributes || {},
	}
}

async function trySendWakeupPackets(client, hosts, wolUrl) {
	if (!hosts?.length) return { err: true }
	if (!client) return { err: true }
	if (!wolUrl) return { err: true }

	let err = false

	logger.debug("Starting wakeup call")
	const baseURL = URL.parse(wolUrl)
	logger.debug("base: ", baseURL.toString())
	const protocol = baseURL.protocol === "https:" ? "wss" : "ws"

	const virtualPort =
		ENV.virtualPort && `${ENV.virtualPort}`.trim() !== ""
			? ENV.virtualPort
			: null

	for (const host of hosts) {
		let targetUrl = wolUrl
		let payload

		if (host.isVirtual) {
			if (!virtualPort) continue

			targetUrl = `http://${host.ip}:${virtualPort}`
			payload = {
				id: host.id,
				startupTime: host.startupTime,
			}
		} else {
			payload = {
				ip: host.ip,
				mac: host.mac,
				startupTime: host.startupTime,
			}
		}

		logger.debug(
			`Sending WoL packets to ${targetUrl}: ${JSON.stringify(payload)}`
		)

		const response = await request.post(targetUrl, payload)

		let data = null

		if (response) {
			try {
				data = await response.json()
			} catch {
				data = null
			}
		}

		if (!data?.client_id) {
			err = true

			sendToClient(client, {
				success: false,
				error: true,
				message: `WoL request failed`,
			})

			errorClient(client, err)

			break
		}

		const hostClientId = response.client_id

		const wsURL = `${protocol}://${baseURL.host}/ws?client_id=${hostClientId}`
		const ws = new WebSocket(wsURL)

		let finished = false

		ws.on("message", (msg) => {
			let data
			try {
				data = JSON.parse(msg)
			} catch {
				return
			}

			if (data.error === true) {
				err = true
			}

			sendToClient(client, {
				success: false,
				error: err,
				message: data.message,
			})

			errorClient(client, err)

			if (data.success === true) {
				finished = true
				ws.close()
			} else if (err) {
				ws.close()
			}
		})

		ws.on("close", () => {
			if (!finished && !err) {
				err = true

				sendToClient(client, {
					error: true,
					message: `WoL WebSocket closed unexpectedly`,
				})

				errorClient(client, err)
			}
		})

		ws.on("error", () => {
			err = true

			logger.error("Error during WebSocket connection: ", err.message)

			sendToClient(client, {
				success: false,
				error: true,
				message: `WoL WebSocket error for host`,
			})
		})

		await new Promise((resolve) => {
			ws.on("close", resolve)
			ws.on("error", resolve)
		})

		if (err) break
	}

	return { err }
}

async function waitForHostUp(url, options = {}) {
	const { interval = 3000, timeout = 60000 } = options
	const start = Date.now()

	while (Date.now() - start < timeout) {
		const res = await request.get(url, {
			headers: {
				"X-Redirect-Service": 1,
			},
		})

		if (res == null) {
			continue
		}

		if (res.ok && !res.headers.get("X-Redirect-Service")) {
			return true
		}

		await new Promise((r) => setTimeout(r, interval))
	}

	return false
}

async function startProcessing(req, res) {
	if (!req.isAuthenticated()) {
		return res.json({ error: true, message: "Unauthorized" })
	}

	const originalUrl = req.cookies.serviceUrl
	if (!originalUrl) {
		return res.json({ error: true, message: "Missing serviceUrl cookie" })
	}

	let serviceURL
	try {
		serviceURL = new URL(originalUrl)
	} catch (err) {
		return res.status(400).json({ error: true, message: "Invalid serviceUrl" })
	}

	const resolved = getDataByHostname(serviceURL.hostname)

	if (!resolved) {
		return res.json({ error: true, message: "No route for hostname" })
	}

	const clientID = wss.createClientID()

	res.json({
		client_id: clientID,
	})

	const { hosts, routeAttributes } = resolved

	let err = false

	const wolEnabled = typeof ENV.wolURL === "string" && ENV.wolURL.trim() !== ""

	let wolResult = null

	const ws = wss.getClient(clientID)

	if (!ws) {
		return
	}

	if (wolEnabled && hosts.length > 0) {
		wolResult = await trySendWakeupPackets(ws, hosts, ENV.wolURL)
	}

	if (wolResult) {
		err = wolResult.err
	}

	errorClient(ws, err)

	const wakeDocker = Boolean(routeAttributes.wakeDocker)

	const woldEnabled =
		typeof ENV.woldURL === "string" && ENV.woldURL.trim() !== ""

	if (wakeDocker && woldEnabled) {
		const context = {
			HOST: serviceURL.host,
			HOSTNAME: serviceURL.hostname,
			PORT: serviceURL.port || "",
			PROTOCOL: serviceURL.protocol,
			URL: originalUrl,
			PATH: serviceURL.pathname,
		}

		const queryPattern = routeAttributes.queryPattern || ENV.woldQueryPattern

		const query = buildQuery(queryPattern, context)

		logger.debug(
			`Sending WoL-Dockerized packets to ${ENV.woldURL}: ${JSON.stringify({
				query: query,
			})}`
		)

		const dockerRes = await request.post(ENV.woldURL, { query: query })

		const data = await request.json()

		if (data?.output) {
			sendToClient(ws, {
				error: err,
				message: dockerRes.output,
			})
		}
	}

	const isReady = await waitForHostUp(serviceURL)

	if (!isReady) {
		err = true

		sendToClient(ws, {
			error: err,
			message: "Timeout waiting for service",
		})
	}

	errorClient(ws, err)

	sendToClient(ws, {
		url: originalUrl,
		message: "",
		error: err,
		host: serviceURL.hostname,
	})
}

function sendToClient(ws, data) {
	if (ws.readyState === WebSocket.OPEN) {
		ws.send(JSON.stringify(data))
		return true
	}
	return false
}

function errorClient(ws, err) {
	if (err) {
		if (ws.readyState === WebSocket.OPEN) {
			ws.close()
		}
		return true
	}
	return false
}

router.get("/start", async (req, res) => await startProcessing(req, res))

module.exports = router
