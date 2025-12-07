const logger = require("./logger")

async function post(url, data) {
	try {
		const response = await fetch(url, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(data),
		})

		if (!response.ok) {
			throw new Error(`${url} returned HTTP ${response.status}`)
		}

		return response
	} catch (err) {
		logger.error(
			`POST error: ${err.message}; cause: ${JSON.stringify(err.cause)}`
		)
		return null
	}
}

async function get(url, options) {
	try {
		const response = await fetch(url, options)

		if (!response.ok) {
			throw new Error(`${url} returned HTTP ${response.status}`)
		}

		return response
	} catch (err) {
		logger.error(
			`GET error: ${err.message}; cause: ${JSON.stringify(err.cause)}`
		)
		return null
	}
}

module.exports = { post, get }
