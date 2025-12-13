const THEME_KEY = "theme"

export function setTheme(theme) {
	document.body.setAttribute("data-theme", theme)
	localStorage.setItem(THEME_KEY, theme)
}

export function applyInitialTheme() {
	const saved = localStorage.getItem(THEME_KEY)
	const system = matchMedia("(prefers-color-scheme: dark)").matches
	const theme = saved || (system ? "dark" : "light")

	document.documentElement.setAttribute("data-theme", theme)
}

export function initToggle(query = ".theme-toggle") {
	const toggle = document.querySelector(query)
	if (!toggle) return

	toggle.addEventListener("click", () => {
		const html = document.documentElement
		const next = html.getAttribute("data-theme") === "dark" ? "light" : "dark"

		html.setAttribute("data-theme", next)
		localStorage.setItem(THEME_KEY, next)
	})
}
