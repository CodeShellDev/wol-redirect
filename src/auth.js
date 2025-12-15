import * as express from "express"
import { v4 as uuidv4 } from "uuid"

import session from "express-session"
import { RedisStore } from "connect-redis"

import passport from "passport"
import OAuth2Strategy from "passport-oauth2"

import { ENV } from "./env.js"
import { logger } from "./utils/logger.js"

import {
	redisClient,
	ReadFromCache,
	WriteToCache,
	DeleteFromCache,
} from "./db.js"

const router = express.Router()

let redirectURL

async function fetchUserInfo(accessToken) {
	try {
		const res = await fetch(ENV.resourceURL, {
			headers: {
				Authorization: `Bearer ${accessToken}`,
				Accept: "application/json",
			},
		})

		if (!res.ok) {
			throw new Error(`Userinfo request failed: ${res.status}`)
		}

		return await res.json()
	} catch (err) {
		logger.error(`Userinfo fetch failed: ${err.message}`)
		throw err
	}
}

function getOriginalUrl(req) {
	const originalHost = req.headers["x-forwarded-host"] || req.get("host")
	const originalProto = req.headers["x-forwarded-proto"] || req.protocol
	const originalUri = req.headers["x-forwarded-uri"] || req.originalUrl

	const originalUrl = `${originalProto}://${originalHost}${originalUri}`

	return originalUrl
}

function registerOauth() {
	if (!redirectURL) return

	passport.use(
		new OAuth2Strategy(
			{
				authorizationURL: ENV.authorizationURL,
				tokenURL: ENV.tokenURL,
				clientID: ENV.clientID,
				clientSecret: ENV.clientSecret,
				callbackURL: ENV.redirectURL,
				scope: ENV.scope,
			},
			async (accessToken, refreshToken, profile, done) => {
				try {
					const userInfo = await fetchUserInfo(accessToken)

					const username = userInfo.username || userInfo.preferred_username
					const email = userInfo.email
					const locale = userInfo.locale

					if (!username) {
						return done(new Error("No username provided by IDP"))
					}

					return done(null, {
						accessToken,
						username,
						email,
						locale,
						rawUserInfo: userInfo,
					})
				} catch (err) {
					return done(err)
				}
			}
		)
	)

	passport.serializeUser((user, done) => done(null, user))
	passport.deserializeUser((user, done) => done(null, user))

	router.use(
		session({
			store: new RedisStore({ client: redisClient }),
			secret: ENV.sessionKey,
			resave: false,
			saveUninitialized: false,
			cookie: {
				domain: redirectURL.hostname,
				secure: true,
				sameSite: "lax",
				maxAge: 1000 * 60 * 60,
			},
		})
	)

	router.use(passport.initialize())
	router.use(passport.session())

	router.get("/", async (req, res, next) => {
		// auth.com => app.com
		if (req.query.state) {
			const state = req.query.state

			const sessionID = await ReadFromCache(`oauth_state=${state}`)
			if (!sessionID) {
				return res.status(400).send("Invalid or expired oauth state")
			}

			await DeleteFromCache(`oauth_state=${state}`)

			res.cookie("session_id", sessionID, {
				domain: redirectURL.hostname,
				httpOnly: true,
				secure: true,
				sameSite: "lax",
				maxAge: 1000 * 60 * 60,
			})
		}

		// entry.com => app.com
		if (req.hostname !== redirectURL.hostname) {
			const originalUrl = getOriginalUrl(req)
			logger.debug("Cached entrypoint: " + originalUrl)

			const sessionID = uuidv4()
			const state = uuidv4()

			await WriteToCache(`service=${sessionID}`, originalUrl)

			await WriteToCache(`oauth_state=${state}`, sessionID, { expire: 600 })

			return res.redirect(`${redirectURL.origin}/?state=${state}`)
		}

		// app.com => auth.com
		if (!req.isAuthenticated()) {
			return res.redirect("/auth")
		}

		next()
	})

	router.get("/auth", passport.authenticate("oauth2"))

	router.get("/auth/callback", passport.authenticate("oauth2"), (req, res) =>
		res.redirect("/")
	)

	router.get("/logout", (req, res) => {
		if (!req.isAuthenticated()) return

		req.session.destroy(() => {
			req.logout(() => res.redirect(ENV.logoutURL))
		})
	})
}

function registerFakeAuth() {
	router.use(
		session({
			store: new RedisStore({ client: redisClient }),
			secret: ENV.sessionKey,
			resave: false,
			saveUninitialized: false,
			cookie: {
				secure: true,
				sameSite: "lax",
				maxAge: 1000 * 60 * 60,
			},
		})
	)

	router.use((req, res, next) => {
		if (req.session?.user) {
			req.user = req.session.user
			req.isAuthenticated = () => true
		} else {
			req.isAuthenticated = () => false
		}
		next()
	})

	router.get("/", async (req, res, next) => {
		const originalUrl = getOriginalUrl(req)

		let originalURL
		try {
			originalURL = new URL(originalUrl)
		} catch (err) {
			logger.error("Error parsing service URL: ", originalUrl)
		}

		if (!req.isAuthenticated()) {
			req.session.user = {
				username: originalURL.hostname,
				email: "",
				locale: "",
			}
		}

		const sessionID = uuidv4()

		res.cookie("session_id", sessionID, {
			httpOnly: true,
			secure: true,
			sameSite: "lax",
			maxAge: 1000 * 60 * 60,
		})

		await WriteToCache(
			`${redirectURL?.origin || ""}/service=${sessionID}`,
			originalUrl
		)

		next()
	})

	router.get("/auth", (req, res) => {
		return res.redirect("/")
	})

	router.get("/logout", (req, res) => {
		if (!req.isAuthenticated()) return

		req.session.destroy()
	})
}

export function Router() {
	try {
		redirectURL = new URL(ENV.redirectURL)
	} catch {}

	if (ENV.useOauth) {
		if (!redirectURL) {
			logger.error("Error parsing redirect URL: ", ENV.redirectURL)
		}

		registerOauth()
	} else {
		registerFakeAuth()
	}

	return router
}
