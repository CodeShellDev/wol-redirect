import { ENV } from "./env.js"
import { logger } from "./utils/logger.js"

import { createClient } from "redis"

export let redisClient

export async function Init() {
	const password = encodeURIComponent(ENV.redisPassword)

	redisClient = createClient({
		url: `redis://${ENV.redisUser}:${password}@${ENV.redisHost}:${ENV.redisPort}`,
	})

	redisClient.on("error", (err) => logger.error("Redis error: ", err))

	await redisClient.connect()

	logger.debug("Connected to Redis")
}

export async function ReadFromCache(key, { hash = false } = {}) {
	if (hash) {
		return await redisClient.hGetAll(key)
	} else {
		return await redisClient.get(key)
	}
}

export async function WriteToCache(
	key,
	value,
	{ hash = false, expire = 3600 } = {}
) {
	if (hash) {
		await redisClient.hSet(key, value)
	} else {
		await redisClient.set(key, value)
	}

	await redisClient.expire(key, expire)
}

export async function DeleteFromCache(key, { hash = false } = {}) {
	if (hash) {
		await redisClient.hDel(key)
	} else {
		await redisClient.del(key)
	}
}

export async function Close() {
	await redisClient.quit()
}
