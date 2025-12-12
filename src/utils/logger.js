const COLORS = {
	fatal: "\x1b[31m", // red
	error: "\x1b[31m", // red
	warn: "\x1b[33m", // yellow
	dev: "\x1b[32m", // green
	info: "\x1b[34m", // blue
	debug: "\x1b[35m", // magenta
	reset: "\x1b[0m",
}

class Logger {
	constructor(options = {}) {
		this.level = options.level || "info"
		this.levels = ["error", "warn", "info", "debug", "dev"]
	}

	shouldLog(type) {
		return this.levels.indexOf(type) <= this.levels.indexOf(this.level)
	}

	timestamp() {
		const d = new Date()
		const pad = (n) => n.toString().padStart(2, "0")

		// DD.MM HH:MM
		return `${pad(d.getDate())}.${pad(d.getMonth() + 1)} ${pad(
			d.getHours()
		)}:${pad(d.getMinutes())}`
	}

	colorLabel(type) {
		return `${COLORS[type]}[${type.toUpperCase()}]${COLORS.reset}`
	}

	format(type, msg, context) {
		const ts = this.timestamp()
		const label = this.colorLabel(type) // only this is colored
		const base = `${ts} ${label} ${msg}`
		return context ? `${base} | ${JSON.stringify(context)}` : base
	}

	output(type, formatted, includeStack) {
		if (includeStack) {
			const stack = new Error().stack.split("\n").slice(2).join("\n")
			console[type === "error" ? "error" : "log"](formatted + "\n" + stack)
		} else {
			console[type === "error" ? "error" : "log"](formatted)
		}
	}

	log(type, msg, { context = null, stack = false } = {}) {
		if (!this.shouldLog(type)) return
		const formatted = this.format(type, msg, context)
		this.output(type, formatted, stack)
	}

	fatal(msg, opts) {
		this.log("fatal", msg, opts)
		process.exit(1)
	}
	error(msg, opts) {
		this.log("error", msg, opts)
	}
	warn(msg, opts) {
		this.log("warn", msg, opts)
	}
	info(msg, opts) {
		this.log("info", msg, opts)
	}
	debug(msg, opts) {
		this.log("debug", msg, opts)
	}
	dev(msg, opts) {
		this.log("dev", msg, opts)
	}
}

const logger = new Logger()

function Init(logLevel) {
	if (logLevel) {
		logger.level = logLevel.toLowerCase()
	}
}

function Log() {
	logger.info(`Initialized Logger with Level of ${logger.level}`)
}

export default { Init, Log, logger }
