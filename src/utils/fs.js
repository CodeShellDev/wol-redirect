const fs = require("fs")
const path = require("path")

function exists(p) {
	fs.stat(p, function (err, stat) {
		if (err == null) {
			return true
		} else if (err.code === "ENOENT") {
			return false
		} else {
			return false
		}
	})
}

module.exports = { exists }
