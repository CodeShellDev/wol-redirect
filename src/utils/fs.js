const fs = require("fs")

function exists(p) {
	try {
		fs.statSync(p)
		return true
	} catch (err) {
		return false
	}
}

module.exports = { exists }
