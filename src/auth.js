import * as express from "express"

import session from "express-session"
import { RedisStore } from "connect-redis"

import passport from "passport"
import OAuth2Strategy from "passport-oauth2"

import { ENV } from "./env.js"
import { logger } from "./utils/logger.js"

import {
	redisClient,
	GetFromCache,
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

function Init() {
	redirectURL = new URL(ENV.redirectURL)

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
				secure: true,
				maxAge: 1000 * 60 * 60,
			},
		})
	)

	router.use(passport.initialize())
	router.use(passport.session())

	router.get("/", async (req, res) => {
		const key = `service=${req.sessionID}`

		const serviceUrl = await GetFromCache(key)

		logger.dev("ServiceURL: ", serviceUrl)

		if (req.hostname !== redirectURL.hostname) {
			const originalHost = req.headers["x-forwarded-host"] || req.get("host")
			const originalProto = req.headers["x-forwarded-proto"] || req.protocol
			const originalUri = req.headers["x-forwarded-uri"] || req.originalUrl

			const originalUrl = `${originalProto}://${originalHost}${originalUri}`

			await WriteToCache(key, originalUrl)

			logger.dev("Cached ", originalUrl, " under ", key)

			return res.redirect(`${redirectURL.origin}`)
		}

		if (!req.isAuthenticated()) {
			return res.redirect("/auth")
		}

		res.render("home", {
			user: {
				name: req.user.username,
				locale: req.user.locale,
				email: req.user.email,
			},
			service: serviceUrl,
		})

		await DeleteFromCache(key)
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

export function Router() {
	Init()

	return router
}
