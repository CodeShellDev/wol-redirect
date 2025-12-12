const { ENV } = require("./env")
const { logger } = require("./utils/logger")

const redis = require("redis")

let redisClient

async function Init() {
	const password = encodeURIComponent(ENV.redisPassword)

	redisClient = redis.createClient({
		url: `redis://${ENV.redisUser}:${password}@${ENV.redisHost}:${ENV.redisPort}`,
	})

	redisClient.on("error", (err) => logger.error("Redis error: ", err))

	await redisClient.connect()

	logger.debug("Connected to Redis")
}

async function GetFromCache(key, { hash = false } = {}) {
	if (hash) {
		return await redisClient.hGetAll(key)
	} else {
		return await redisClient.get(key)
	}
}

async function WriteToCache(key, value, { hash = false } = {}) {
	if (hash) {
		await redisClient.hSet(key, value)
	} else {
		await redisClient.set(key, value)
	}

	await redisClient.expire(key, 3600)
}

async function DeleteFromCache(key, { hash = false } = {}) {
	if (hash) {
		await redisClient.hDel(key)
	} else {
		await redisClient.del(key)
	}
}

module.exports = {
	redisClient,
	Init,
	GetFromCache,
	WriteToCache,
	DeleteFromCache,
}
