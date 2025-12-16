import express, { Router } from "express"
import { createServer } from "http"
import cookieParser from "cookie-parser"

import { Init } from "./db.js"
import * as log from "./utils/logger.js"
import * as env from "./env.js"

import { Router as auth } from "./auth.js"
import { Router as wol } from "./wol.js"
import { Attach } from "./wss.js"

const app = express()

app.use(express.static("public"))

app.set("view engine", "ejs")
app.set("trust proxy", true)

app.use((req, res, next) => {
	res.setHeader("X-Redirect-Service", "1")

	if (req.headers["x-redirect-service"]) {
		return res.status(200).end()
	}

	const url = new URL(req.url, `${req.protocol}://${req.hostname}`)

	log.logger.info(`${req.method} ${url.pathname} ${url.search}`)
	next()
})

log.Init()
env.Load()

if (log.logger.level != env.ENV.logLevel) {
	log.Init(env.ENV.logLevel)
}

log.logger.info(`Running ${process.env.IMAGE_TAG} Image`)

log.Log()

await Init()

app.use(cookieParser())

const rootRouter = Router()

rootRouter.use("/", auth())
rootRouter.use("/", wol())

app.use((req, res, next) => {
	const origRedirect = res.redirect.bind(res)
	res.redirect = function redirectOverride(...args) {
		let target = args.pop()

		if (typeof target === "string" && target.startsWith("/")) {
			args.push(env.ENV.basePath + target)
		} else {
			args.push(target)
		}

		return origRedirect(...args)
	}

	next()
})

app.use(env.ENV.basePath, rootRouter)

app.use((err, req, res, next) => {
	log.logger.error(err)
	res.status(500).send("Encountered an unexpected error")
})

const server = createServer(app)

Attach(server)

server.listen(env.ENV.port, () => {
	log.logger.info(`Server running on Port ${env.ENV.port}`)
})
