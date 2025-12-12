const express = require("express")
const router = express.Router()

const session = require("express-session")
const cookieParser = require("cookie-parser")

const passport = require("passport")
const OAuth2Strategy = require("passport-oauth2")

const { ENV } = require("./env")
const { logger } = require("./utils/logger")

const redirectURL = new URL(ENV.redirectURL)

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

				if (!username) {
					return done(new Error("No username provided by IDP"))
				}

				return done(null, {
					accessToken,
					username,
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

router.use(cookieParser(ENV.cookieKey))

router.use(
	session({
		secret: ENV.sessionKey,
		resave: false,
		saveUninitialized: false,
		cookie: {
			httpOnly: true,
			secure: true,
			sameSite: "lax",
			maxAge: 1000 * 60 * 15,
		},
	})
)

router.use(passport.initialize())
router.use(passport.session())

router.get("/", (req, res) => {
	if (req.query.serviceUrl) {
		res.cookie("serviceUrl", req.query.serviceUrl, {
			domain: redirectURL.hostname,
			httpOnly: true,
			secure: true,
			sameSite: "lax",
			maxAge: 300000,
		})
	}

	logger.debug(
		`Client requested ${req.hostname}, redirecting to ${redirectURL.hostname}`
	)

	if (req.hostname !== redirectURL.hostname) {
		const originalHost = req.headers["x-forwarded-host"] || req.get("host")
		const originalProto = req.headers["x-forwarded-proto"] || req.protocol
		const originalUri = req.headers["x-forwarded-uri"] || req.originalUrl

		const originalUrl = `${originalProto}://${originalHost}${originalUri}`
		return res.redirect(`${redirectURL.origin}?serviceUrl=${originalUrl}`)
	}

	if (!req.isAuthenticated()) {
		return res.redirect("/auth")
	}

	return res.render("home", {
		username: req.user.username,
		redirect: redirectURL.toString(),
	})
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

module.exports = router
