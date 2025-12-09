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

async function trySendWoLPackets(client, hosts, wolUrl) {
	if (!hosts?.length || !client || !wolUrl) return { err: true }

	const baseURL = new URL(wolUrl)
	const protocol = baseURL.protocol === "https:" ? "wss" : "ws"
	const virtualPort = ENV.virtualPort?.trim() || null

	let err = false

	for (const host of hosts) {
		let targetUrl = wolUrl
		let payload

		if (host.id) {
			if (!virtualPort) continue
			targetUrl = `http://${host.ip}:${virtualPort}`
			payload = { id: host.id, startupTime: host.startupTime }
		} else {
			payload = { ip: host.ip, mac: host.mac, startupTime: host.startupTime }
		}

		logger.debug(
			`Sending WoL packets to ${targetUrl}: ${JSON.stringify(payload)}`
		)

		const response = await request.post(targetUrl, payload)
		let data = null
		if (response) {
			try {
				data = await response.json()
			} catch {}
		}

		if (!data?.client_id) {
			sendToClient(client, {
				success: false,
				error: true,
				message: `WoL request failed for host`,
			})
			return { err: true }
		}

		const wsURL = `${protocol}://${baseURL.host}/ws?client_id=${data.client_id}`
		const ws = new WebSocket(wsURL)

		await new Promise((resolve, reject) => {
			ws.once("open", resolve)
			ws.once("error", () => resolve())
		})

		const hostResult = await new Promise((resolve) => {
			let finished = false

			ws.on("message", (msg) => {
				if (finished) return

				let parsed
				try {
					parsed = JSON.parse(msg)
				} catch {
					return
				}

				sendToClient(client, {
					success: false,
					error: parsed.error || false,
					message: parsed.message || "",
				})

				if (parsed.success) {
					finished = true

					ws.close()
					resolve({ success: true })
				} else if (parsed.error) {
					finished = true

					ws.close()
					resolve({ success: false })
				}
			})

			ws.on("close", () => {
				if (!finished) resolve({ success: false })
			})

			ws.on("error", () => {
				if (!finished) resolve({ success: false })
			})
		})

		if (!hostResult.success) {
			err = true
			break
		}
	}

	return { err }
}

async function trySendWoLDPackets(client, context, targetUrl, queryPattern) {
	const query = buildQuery(queryPattern, context)

	logger.debug(
		`Sending WoLD packets to ${targetUrl}: ${JSON.stringify({
			query: query,
		})}`
	)

	const response = await request.post(targetUrl, payload)
	let data = null
	if (response) {
		try {
			data = await response.json()
		} catch {}
	}

	if (!data?.client_id) {
		sendToClient(client, {
			success: false,
			error: true,
			message: `WoLD request failed for host`,
		})
		return { err: true }
	}

	const wsURL = `${protocol}://${baseURL.host}/ws?client_id=${data.client_id}`
	const ws = new WebSocket(wsURL)

	await new Promise((resolve, reject) => {
		ws.once("open", resolve)
		ws.once("error", () => resolve())
	})

	const woldResult = await new Promise((resolve) => {
		let finished = false

		ws.on("message", (msg) => {
			if (finished) return

			let parsed
			try {
				parsed = JSON.parse(msg)
			} catch {
				return
			}

			sendToClient(client, {
				success: false,
				error: parsed.error || false,
				message: parsed.message || "",
			})

			if (parsed.success) {
				finished = true

				ws.close()
				resolve({ success: true })
			} else if (parsed.error) {
				finished = true

				ws.close()
				resolve({ success: false })
			}
		})

		ws.on("close", () => {
			if (!finished) resolve({ success: false })
		})

		ws.on("error", () => {
			if (!finished) resolve({ success: false })
		})
	})

	return { err: woldResult.success }
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

	const ws = await wss.waitForClient(clientID)

	if (!ws) {
		return
	}

	if (wolEnabled && hosts.length > 0) {
		wolResult = await trySendWoLPackets(ws, hosts, ENV.wolURL)
	}

	if (wolResult) {
		err = wolResult.err
	}

	errorClient(ws, err)

	let woldResult = null

	const wold = routeAttributes?.wold
	const woldEnabled =
		wold === true || (typeof wold === "object" && wold !== null)

	const woldUrl = (routeAttributes?.wold?.url || ENV.woldURL).trim()

	if (woldEnabled && woldUrl !== "") {
		const queryPattern = (wold?.queryPattern || ENV.woldQueryPattern).trim()

		woldResult = await trySendWoLDPackets(
			ws,
			{
				HOST: serviceURL.host,
				HOSTNAME: serviceURL.hostname,
				PORT: serviceURL.port || "",
				PROTOCOL: serviceURL.protocol,
				PATH: serviceURL.pathname,
			},
			woldUrl,
			queryPattern
		)
	}

	if (woldResult) {
		err = woldResult.err
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
