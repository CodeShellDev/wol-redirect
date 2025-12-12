const express = require("express")
const log = require("./utils/logger")
const db = require("./db")
const env = require("./env")
const http = require("http")

const app = express()

async function init() {
	log.Init()

	env.Load()

	log.Log()

	if (log.logger.level != env.ENV.logLevel) {
		log.Init(env.ENV.logLevel)
	}

	await db.Init()
}

app.use(express.static("public"))

app.set("view engine", "ejs")
app.set("trust proxy", true)

app.use((req, res, next) => {
	res.setHeader("X-Redirect-Service", "1")

	if (req.headers["x-redirect-service"]) {
		return res.status(200).end()
	}

	url = URL.parse(req.url, `${req.protocol}://${req.hostname}`)

	log.logger.info(`${req.method} ${url.pathname} ${url.search}`)
	next()
})

init()

const auth = require("./auth")
const wol = require("./wol")

const wss = require("./wss")

app.use("/", auth)
app.use((err, req, res, next) => {
	log.logger.error(err)
	res.status(500).send("Encountered an unexpected error")
})

const server = http.createServer(app)

wss.Attach(server, app, wol)

server.listen(env.ENV.port, () => {
	log.logger.info(`Server running on Port ${env.ENV.port}`)
})
