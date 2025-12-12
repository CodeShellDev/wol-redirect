const logger = require("./utils/logger").logger

const fsutils = require("./utils/fs")

const ENV = {
	configPath: "/app/config/mapping.json",
	port: "6789",
	logLevel: "info",
	exposeLogs: true,

	redisHost: "redis",
	redisPort: "6379",
	redisUser: "default",
	redisPassword: "",

	woldQueryPattern: "",
	wolURL: "",

	woldPort: "7777",
	vePort: "9999",

	sessionKey: "",

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

	ENV.redisHost = process.env.REDIS_HOST || ENV.redisHost
	ENV.redisPort = process.env.REDIS_PORT || ENV.redisPort
	ENV.redisUser = process.env.REDIS_USER || ENV.redisUser
	ENV.redisPassword = process.env.REDIS_PASSWORD || ENV.redisPassword

	ENV.woldQueryPattern = process.env.WOLD_QUERY_PATTERN || ""

	ENV.exposeLogs = process.env.EXPOSE_LOGS || ENV.exposeLogs

	ENV.wolURL = process.env.WOL_URL || ""

	ENV.woldPort = process.env.WOLD_PORT || ENV.woldPort
	ENV.vePort = process.env.VIRTUAL_PORT || ENV.vePort

	if (!ENV.wolURL) {
		logger.warn("No WoL URL set")
	}

	ENV.sessionKey = process.env.SESSION_KEY || ""

	if (!ENV.sessionKey) {
		logger.fatal("No session key provided")
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
