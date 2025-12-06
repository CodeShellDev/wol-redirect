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
	log.logger.info(`${req.method} ${req.path} ${req.query}`)
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
