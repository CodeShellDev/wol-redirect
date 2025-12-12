import { Router } from "express"
import { CreateClientID, WaitForClient } from "./wss"

import WebSocket, { OPEN } from "ws"

import { logger } from "./utils/logger"
import { post, get } from "./utils/request"
import { ENV } from "./env"
import { readFileSync } from "fs"

const router = Router()

const CONFIG = JSON.parse(readFileSync(ENV.configPath, "utf8"))

const HostType = {
	PHYSICAL: "physical",
	VIRTUAL: "virtual",
	DOCKER: "docker",
}

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

	return host
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

function getHostType(host) {
	let type = HostType.PHYSICAL

	if (host?.id !== null && typeof host?.id === "string") {
		type = HostType.VIRTUAL
	} else if (
		host?.docker !== null &&
		(host?.docker == true || typeof host?.docker === "object")
	) {
		type = HostType.DOCKER
	} else if (host?.mac && host?.ip) {
		type = HostType.PHYSICAL
	}

	return type
}

function getDataFromHost(host, serviceUrl) {
	const type = getHostType(host)

	switch (type) {
		case HostType.PHYSICAL:
			const wolUrl = host.url || ENV.wolURL
			const wolURL = URL.parse(wolUrl)

			if (!wolURL) {
				return null
			}

			return {
				url: wolUrl,
				payload: {
					addr: host.addr,
					ip: host.ip,
					mac: host.mac,
					startupTime: host.startupTime,
				},
			}
		case HostType.VIRTUAL:
			const virtualUrl = host.url || `http://${host.ip}:${ENV.vePort}/wake`

			const virtualURL = URL.parse(virtualUrl)

			if (!virtualURL) {
				return null
			}

			return {
				url: virtualUrl,
				payload: {
					id: host.id,
					ip: host.virtIP,
					startupTime: host.startupTime,
				},
			}
		case HostType.DOCKER:
			const woldUrl = host.url || `http://${host.ip}:${ENV.woldPort}/wake`

			const woldURL = URL.parse(woldUrl)

			if (!woldURL) {
				return null
			}

			const serviceURL = URL.parse(serviceUrl)

			if (!serviceURL) {
				return null
			}

			const queryPattern = host.docker.queryPattern || ENV.woldQueryPattern
			const context = {
				HOST: serviceURL.host,
				HOSTNAME: serviceURL.hostname,
				PORT: serviceURL.port || "",
				PROTOCOL: serviceURL.protocol,
				PATH: serviceURL.pathname,
			}

			const query = buildQuery(queryPattern, context)

			return {
				url: woldUrl,
				payload: {
					query: query,
				},
			}
	}

	return null
}

async function trySendWoLPackets(client, hosts, serviceUrl) {
	if (!hosts?.length || !client) return { err: true }

	let err = false

	for (const host of hosts) {
		const data = getDataFromHost(host, serviceUrl)

		if (data === null) {
			logger.error("Could not parse host: ", host)
			err = true
			break
		}

		const targetUrl = data.url
		const targetURL = URL.parse(targetUrl)

		if (!targetURL) {
			logger.error("Could not parse target url: ", host)
			err = true
			break
		}

		const payload = data.payload

		logger.debug(
			`Sending WoL request to ${targetUrl}: ${JSON.stringify(payload)}`
		)

		const response = await post(targetUrl, payload)
		let responseData = null
		if (response) {
			try {
				responseData = await response.json()
			} catch {}
		}

		if (!responseData?.client_id) {
			sendToClient(client, {
				success: false,
				error: true,
				message: ENV.exposeLogs ? `Wakeup request failed for host` : "",
			})
			return { err: true }
		}

		const wsProtocol = targetURL.protocol === "https:" ? "wss" : "ws"
		const wsURL = `${wsProtocol}://${targetURL.host}/ws?client_id=${responseData.client_id}`
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
					message: ENV.exposeLogs ? parsed.message || "" : "",
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

async function waitForHostUp(url, options = {}) {
	const { interval = 3000, timeout = 60000 } = options
	const start = Date.now()

	while (Date.now() - start < timeout) {
		const res = await get(url, {
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
		return res.json({
			error: true,
			message: ENV.exposeLogs ? "Unauthorized" : "",
		})
	}

	const originalUrl = req.cookies.serviceUrl
	if (!originalUrl) {
		return res.json({
			error: true,
			message: ENV.exposeLogs ? "Missing serviceUrl cookie" : "",
		})
	}

	let serviceURL
	try {
		serviceURL = new URL(originalUrl)
	} catch (err) {
		return res.status(400).json({
			error: true,
			message: ENV.exposeLogs ? "Invalid serviceUrl" : "",
		})
	}

	const resolved = getDataByHostname(serviceURL.hostname)

	if (!resolved) {
		return res.json({
			error: true,
			message: ENV.exposeLogs ? "No route for hostname" : "",
		})
	}

	const clientID = CreateClientID()

	res.json({
		client_id: clientID,
	})

	const { hosts, routeAttributes } = resolved

	let err = false

	let wolResult = null

	const ws = await WaitForClient(clientID)

	if (!ws) {
		return
	}

	if (hosts.length <= 0) {
		err = true
		errorClient(ws, err)
		return
	}

	wolResult = await trySendWoLPackets(ws, hosts, originalUrl)

	err = wolResult.err

	errorClient(ws, err)

	const isReady = await waitForHostUp(serviceURL)

	if (!isReady) {
		err = true

		sendToClient(ws, {
			error: err,
			message: ENV.exposeLogs ? "Timeout waiting for service" : "",
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
	if (ws.readyState === OPEN) {
		ws.send(JSON.stringify(data))
		return true
	}
	return false
}

function errorClient(ws, err) {
	if (err) {
		if (ws.readyState === OPEN) {
			ws.close()
		}
		return true
	}
	return false
}

router.get("/start", async (req, res) => await startProcessing(req, res))

export default router
