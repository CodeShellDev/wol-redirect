import express from "express"
import { createServer } from "http"

import { Init } from "./db.js"
import * as log from "./utils/logger.js"
import * as env from "./env.js"

import { Router as auth } from "./auth.js"
import { Router as wol } from "./wol.js"
import * as wss from "./wss.js"

const app = express()

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

if (log.logger.level != env.ENV.logLevel) {
	log.Init(env.ENV.logLevel)
}

log.Init()
env.Load()
log.Log()

await Init()

app.use("/", auth)
app.use((err, req, res, next) => {
	log.logger.error(err)
	res.status(500).send("Encountered an unexpected error")
})

const server = createServer(app)

wss.Attach(server, app, wol)

server.listen(env.ENV.port, () => {
	log.logger.info(`Server running on Port ${ENV.port}`)
})
