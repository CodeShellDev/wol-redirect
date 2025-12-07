const express = require("express")
const wss = require("./wss")

const { logger } = require("./utils/logger")
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

async function post(url, data) {
	try {
		const response = await fetch(url, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(data),
		})

		if (!response.ok) {
			throw new Error(`POST to ${url} returned HTTP ${response.status}`)
		}

		return await response.json()
	} catch (err) {
		logger.error(
			`POST error: ${err.message}; cause: ${JSON.stringify(err.cause)}`
		)
		return null
	}
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

async function trySendWakeupPackets(hosts, wolUrl) {
	if (!hosts?.length) return null
	if (typeof wolUrl !== "string" || wolUrl.trim() === "") return null

	let output = ""
	let err = false

	const virtualPort =
		ENV.virtualPort && `${ENV.virtualPort}`.trim() !== ""
			? ENV.virtualPort
			: null

	for (const host of hosts) {
		const ip = host.ip

		let targetUrl = wolUrl
		let payload

		if (host.isVirtual) {
			if (!virtualPort) {
				continue
			}

			targetUrl = `http://${ip}:${virtualPort}`
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

		const response = await post(targetUrl, payload)
		if (!response?.message) {
			err = true
			break
		}

		const msg = response.message

		if (msg.output && !host.isVirtual) {
			output += msg.output
		}

		if (msg.success === false) {
			err = true
			break
		}
	}

	return { output, err }
}

async function waitForHostUp(url, options = {}) {
	const { interval = 3000, timeout = 60000 } = options
	const start = Date.now()

	while (Date.now() - start < timeout) {
		try {
			const res = await fetch(url, {
				method: "GET",
				headers: {
					"X-Redirect-Service": 1,
				},
			})

			if (res.ok && !res.headers.get("X-Redirect-Service")) {
				return true
			}
		} catch {}

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

	const requestId = wss.createRequestId()

	res.json({ error: false, message: "Start request received", requestId })

	const { hosts, routeAttributes } = resolved

	let err = false

	const wolEnabled = typeof ENV.wolURL === "string" && ENV.wolURL.trim() !== ""

	let wolResult = null

	if (wolEnabled && hosts.length > 0) {
		wolResult = await trySendWakeupPackets(hosts, ENV.wolURL)
	}

	const ws = wss.getClient(requestId)

	if (!ws) {
		return
	}

	if (wolResult) {
		err = wolResult.err

		sendToClient(ws, {
			error: err,
			message: wolResult.output,
		})
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

		const dockerRes = await post(ENV.woldURL, { query: query })

		if (dockerRes?.output) {
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
		requestId,
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
