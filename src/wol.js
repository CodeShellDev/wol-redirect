const { logger } = require("./utils/logger")
const { ENV } = require("./env")
const fs = require("fs")

const CONFIG = JSON.parse(fs.readFileSync(ENV.configPath, "utf8"))

function buildQuery(pattern, context) {
	return Object.entries(context).reduce(
		(query, [key, value]) => query.replaceAll(`{${key}}`, value),
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
			throw new Error(`POST to ${url} returned ${response.status}`)
		}

		return await response.json()
	} catch (err) {
		logger.error(`POST error: ${err.message}`)
		return null
	}
}

function resolveRecord(hostname) {
	const { records } = CONFIG

	if (records[hostname]) {
		return { record: records[hostname], wildcard: false }
	}

	if (records.any) {
		logger.debug(`Using wildcard record`)
		return { record: records.any, wildcard: true }
	}

	logger.warn(`No record for hostname: ${hostname}`)
	return null
}

function resolveRoute(record) {
	const routeObj = CONFIG.routes[record]

	if (!routeObj) {
		logger.warn(`No route for record: ${record}`)
		return null
	}

	if (!routeObj.route) {
		logger.warn(`Route missing "route" array: ${record}`)
		return null
	}

	return routeObj
}

function buildHostEntry(routeItem) {
	let host = CONFIG.hosts[routeItem]

	if (!host) {
		logger.warn(`Host missing: ${routeItem}`)

		if (!CONFIG.hosts.any) {
			return null
		}

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
	const resolved = resolveRecord(hostname)
	if (!resolved) return null

	const routeObj = resolveRoute(resolved.record)
	if (!routeObj) return null

	const hosts = routeObj.route.map(buildHostEntry).filter(Boolean)

	return {
		hosts,
		routeAttributes: routeObj.attributes || {},
	}
}

async function startProcessing(req, res) {
	if (!req.isAuthenticated()) {
		return res.json({ error: true, log: "Unauthorized" })
	}

	const originalUrl = req.cookies.serviceUrl
	if (!originalUrl) {
		return res.json({ error: true, log: "Missing serviceUrl cookie" })
	}

	const url = new URL(originalUrl)
	const hostsData = getDataByHostname(url.hostname)

	const context = {
		HOST: url.host,
		HOSTNAME: url.hostname,
		PORT: url.port || "",
		PROTOCOL: url.protocol,
		URL: originalUrl,
		PATH: url.pathname,
	}

	const query = buildQuery(ENV.queryPattern, context)
	let output = ""
	let err = false

	const hosts = hostsData?.hosts || []
	const wakeDocker = Boolean(hostsData?.routeAttributes?.wakeDocker)

	let wolPromise = Promise.resolve(null)

	if (ENV.wolURL && hosts.length > 0) {
		wolPromise = trySendWakeupPackets(hosts, ENV.wolURL)
	}

	wolPromise
		.then((wol) => {
			err = wol.err

			if (ENV.exposeLogs) {
				output += woldRes.output
			}

			if (!err && wakeDocker && ENV.woldURL) {
				return post(ENV.woldURL, { query })
			}

			return null
		})
		.then((woldRes) => {
			err = wold.err

			if (ENV.exposeLogs) {
				output += woldRes.output
			}

			res.json({
				url: originalUrl,
				log: output,
				error: err,
				host: url.hostname,
			})
		})
		.catch((error) => {
			logger.error(`Processing error: ${error.message}`)
			res.json({
				url: originalUrl,
				log: "Internal processing error.",
				error: true,
			})
		})
}

module.exports = startProcessing
