const express = require("express")
const log = require("./utils/logger")
const env = require("./env")
const http = require("http")

const app = express()

log.Init()

env.Load()

log.Log()

if (log.logger.level != env.ENV.logLevel) {
	log.Init(env.ENV.logLevel)
}

app.set("view engine", "ejs")
app.set("trust proxy", true)

app.use((req, res, next) => {
	res.setHeader("X-Redirect-Service", "1")

	if (req.headers["x-redirect-service"]) {
		return res.status(200).end()
	}

	url = new URL(req.url)

	log.logger.info(`${req.method} ${url.pathname} ${url.search}`)
	next()
})

const auth = require("./auth")
const wol = require("./wol")

const wss = require("./wss")

app.use("/", auth)

const server = http.createServer(app)

wss.attach(server, app, wol)

server.listen(env.ENV.port, () => {
	log.logger.info(`Server running on Port ${env.ENV.port}`)
})
