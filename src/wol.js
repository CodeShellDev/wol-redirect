const { logger } = require("./utils/logger")
const { ENV } = require("./env")
const fs = require("fs")

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
		logger.error(`POST error: ${err.message}`)
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

		logger.debug(`Sending WoL to ${targetUrl}: ${JSON.stringify(payload)}`)

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

async function startProcessing(req, res) {
	if (!req.isAuthenticated()) {
		return res.json({ error: true, log: "Unauthorized" })
	}

	const originalUrl = req.cookies.serviceUrl
	if (!originalUrl) {
		return res.json({ error: true, log: "Missing serviceUrl cookie" })
	}

	let serviceURL
	try {
		serviceURL = new URL(originalUrl)
	} catch (err) {
		return res.status(400).json({ error: true, log: "Invalid serviceUrl" })
	}

	const resolved = getDataByHostname(serviceURL.hostname)

	if (!resolved) {
		return res.json({ error: true, log: "No route for hostname" })
	}

	const { hosts, routeAttributes } = resolved

	const context = {
		HOST: serviceURL.host,
		HOSTNAME: serviceURL.hostname,
		PORT: serviceURL.port || "",
		PROTOCOL: serviceURL.protocol,
		URL: originalUrl,
		PATH: serviceURL.pathname,
	}

	const query = buildQuery(ENV.queryPattern, context)

	let output = ""
	let err = false

	const wakeDocker = Boolean(routeAttributes.wakeDocker)

	const wolEnabled = typeof ENV.wolURL === "string" && ENV.wolURL.trim() !== ""

	const woldEnabled =
		typeof ENV.woldURL === "string" && ENV.woldURL.trim() !== ""

	const wolResult =
		wolEnabled && hosts.length > 0
			? await trySendWakeupPackets(hosts, ENV.wolURL)
			: null

	logger.debug(JSON.stringify(wolResult))

	return res.json({
		test: "HELLO",
	})

	if (wolResult) {
		err = wolResult.err
		if (ENV.exposeLogs) output += wolResult.output
	}

	if (!err && wakeDocker && woldEnabled) {
		logger.debug(
			`Sending WoL-D to ${ENV.woldURL}: ${JSON.stringify({ query })}`
		)

		const dockerRes = await post(ENV.woldURL, { query })

		if (dockerRes?.output && ENV.exposeLogs) {
			output += dockerRes.output
		}
	}

	return res.json({
		test: "HELLO",
	})
}

module.exports = startProcessing
