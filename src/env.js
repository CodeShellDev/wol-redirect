const logger = require("./utils/logger").logger

const fsutils = require("./utils/fs")

const ENV = {
	configPath: "config/mapping.json",
	port: "6789",
	logLevel: "info",
	exposeLogs: false,

	woldQueryPattern: "",
	wolURL: null,
	woldURL: null,
	virtualPort: "",

	sessionKey: "",
	cookieKey: "",

	authorizationURL: "",
	resourceURL: "",
	logoutURL: "",
	tokenURL: "",
	redirectURL: "",

	clientID: "",
	clientSecret: "",
	scope: "openid profile",
}

function Load() {
	let configPath = process.env.CONFIG_PATH || ENV.configPath

	if (fsutils.exists(configPath)) {
		ENV.configPath = configPath
	} else {
		logger.fatal(`${configPath} not found`)
	}

	ENV.port = process.env.PORT || ENV.port
	ENV.logLevel = process.env.LOG_LEVEL || ENV.logLevel

	ENV.woldQueryPattern = process.env.WOLD_QUERY_PATTERN

	ENV.exposeLogs = process.env.EXPOSE_LOGS || ENV.exposeLogs

	if (ENV.woldQueryPattern == "") {
		logger.fatal(`Query pattern is empty`)
	}

	ENV.wolURL = process.env.WOL_URL || ""
	ENV.woldURL = process.env.WOLD_URL || ""
	ENV.virtualPort = process.env.VIRTUAL_PORT || ""

	if (!ENV.wolURL) {
		logger.warn("No WoL URL set")
	}
	if (!ENV.woldURL) {
		logger.warn("No WoL docker URL set")
	}
	if (!ENV.virtualPort) {
		logger.warn("No virtual port set")
	}

	ENV.sessionKey = process.env.SESSION_KEY || ""
	ENV.cookieKey = process.env.COOKIE_KEY || ""

	if (!ENV.sessionKey) {
		logger.fatal("No session key provided")
	}
	if (!ENV.cookieKey) {
		logger.fatal("No cookie key provided")
	}

	ENV.authorizationURL = process.env.AUTHORIZATION_URL || ""
	ENV.resourceURL = process.env.RESOURCE_URL || ""
	ENV.logoutURL = process.env.LOGOUT_URL || ""
	ENV.tokenURL = process.env.TOKEN_URL || ""
	ENV.redirectURL = process.env.REDIRECT_URL || ""

	if (!ENV.authorizationURL) {
		logger.fatal("No authorization URL set")
	}
	if (!ENV.resourceURL) {
		logger.fatal("No resource URL set")
	}
	if (!ENV.logoutURL) {
		logger.fatal("No logout URL set")
	}
	if (!ENV.tokenURL) {
		logger.fatal("No token URL set")
	}
	if (!ENV.redirectURL) {
		logger.fatal("No redirect URL set")
	}

	ENV.clientID = process.env.CLIENT_ID || ""
	ENV.clientSecret = process.env.CLIENT_SECRET || ""
	ENV.scope = process.env.SCOPE || ENV.scope

	if (!ENV.clientID) {
		logger.fatal("No client id provided")
	}
	if (!ENV.clientSecret) {
		logger.fatal("No client secret provided")
	}

	logger.info("Loaded Environment")
}

module.exports = { ENV, Load }
