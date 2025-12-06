const express = require("express")
const logger = require("./utils/logger")
const env = require("./env")

const app = express()

logger.Init()

env.Load()

if (logger.logger.level != env.ENV.logLevel) {
	logger.Init(env.ENV.logLevel)
}

app.set("view engine", "ejs")
app.set("trust proxy", true)

app.use((req, res, next) => {
	logger.info(`${req.method} ${req.path} ${req.query}`)
})

const auth = require("./auth")
const wol = require("./wol")

app.use("/", auth)

app.get("/data", wol)

app.listen(env.ENV.port, () => {
	logger.logger.info(`Server running on Port ${env.ENV.port}`)
})
