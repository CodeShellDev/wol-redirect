import { statSync } from "fs"

function exists(p) {
	try {
		statSync(p)
		return true
	} catch (err) {
		return false
	}
}

export default { exists }
