import { statSync } from "fs"

export function exists(p) {
	try {
		statSync(p)
		return true
	} catch (err) {
		return false
	}
}
