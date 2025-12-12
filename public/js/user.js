export function getProfileColor(
	str,
	{ hues = [10, 40, 60, 90, 120, 150, 180, 200, 220, 250, 280, 310, 340] } = {}
) {
	let hash = 0
	for (let i = 0; i < str.length; i++) {
		hash = str.charCodeAt(i) + ((hash << 5) - hash)
	}

	const hue = hues[Math.abs(hash) % hues.length]

	const saturation = 70
	const lightness = 60

	return `hsl(${hue}, ${saturation}%, ${lightness}%)`
}
