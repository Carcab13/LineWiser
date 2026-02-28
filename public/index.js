"use strict";
/**
 * @type {HTMLFormElement}
 */
const form = document.getElementById("sj-form");
/**
 * @type {HTMLInputElement}
 */
const address = document.getElementById("sj-address");
/**
 * @type {HTMLInputElement}
 */
const searchEngine = document.getElementById("sj-search-engine");
/**
 * @type {HTMLParagraphElement}
 */
const error = document.getElementById("sj-error");
/**
 * @type {HTMLPreElement}
 */
const errorCode = document.getElementById("sj-error-code");
const home = document.getElementById("sj-home");
const tabsContainer = document.getElementById("sj-tabs");
const tabList = document.getElementById("sj-tab-list");
const addTabBtn = document.getElementById("sj-add-tab");
const framesContainer = document.getElementById("sj-frames-container");

const navForm = document.getElementById("sj-nav-form");
const navAddress = document.getElementById("sj-nav-address");
const backBtn = document.getElementById("sj-back");
const forwardBtn = document.getElementById("sj-forward");
const reloadBtn = document.getElementById("sj-reload");
const homeBtn = document.getElementById("sj-home-btn");

const { ScramjetController } = $scramjetLoadController();

// Theme utility to make it easy to stylize from console or external scripts
window.sjTheme = {
	setVariable: (name, value) => {
		document.documentElement.style.setProperty(`--${name}`, value);
	},
	reset: () => {
		document.documentElement.removeAttribute("style");
	},
	applyPreset: (preset) => {
		const presets = {
			ocean: {
				"bg-primary": "#001f3f",
				"header-bg": "#003366",
				"nav-bar-bg": "#004080",
				"tab-bg-active": "#005bb7",
				"accent-color": "#7fdbff",
			},
			forest: {
				"bg-primary": "#1a2f1a",
				"header-bg": "#2d4a2d",
				"nav-bar-bg": "#3e623e",
				"tab-bg-active": "#4f7a4f",
				"accent-color": "#2ecc40",
			},
			midnight: {
				"bg-primary": "#000000",
				"header-bg": "#121212",
				"nav-bar-bg": "#1e1e1e",
				"tab-bg-active": "#333333",
				"accent-color": "#bb86fc",
			},
			classic: {
				"bg-primary": "#f0f2f5",
				"header-bg": "#ffffff",
				"nav-bar-bg": "#f0f2f5",
				"tab-bg-active": "#e4e6eb",
				"text-primary": "#050505",
				"text-secondary": "#65676b",
				"text-active": "#1c1e21",
				"text-muted": "#65676b",
				"address-bar-bg": "#f0f2f5",
				"border-color": "#ddd",
				"accent-color": "#1877f2",
			}
		};
		if (presets[preset]) {
			Object.entries(presets[preset]).forEach(([name, value]) => {
				window.sjTheme.setVariable(name, value);
			});
		}
	}
};



const scramjet = new ScramjetController({
	files: {
		wasm: "/scram/scramjet.wasm.wasm",
		all: "/scram/scramjet.all.js",
		sync: "/scram/scramjet.sync.js",
	},
});

scramjet.init();

const connection = new BareMux.BareMuxConnection("/baremux/worker.js");

let tabs = [];
let activeTabId = null;

async function createTab(url = null) {
	const id = Math.random().toString(36).substring(2, 11);
	const tab = {
		id,
		url,
		title: url ? "Loading..." : "New Tab",
	};

	const tabEl = document.createElement("div");
	tabEl.className = "tab";
	tabEl.id = `tab-${id}`;
	tabEl.innerHTML = `
        <span class="tab-title">${tab.title}</span>
        <span class="close-tab">&times;</span>
    `;

	tabEl.addEventListener("click", (e) => {
		if (e.target.classList.contains("close-tab")) {
			closeTab(id);
		} else {
			switchTab(id);
		}
	});

	tabList.appendChild(tabEl);

	const frame = scramjet.createFrame();
	frame.frame.className = "sj-frame";
	frame.frame.id = `frame-${id}`;
	framesContainer.appendChild(frame.frame);

	tab.frame = frame;
	tab.tabEl = tabEl;

	tabs.push(tab);

	if (url) {
		await loadUrlInTab(id, url);
	}

	switchTab(id);

	// Update title and URL when frame loads
	frame.frame.addEventListener("load", () => {
		try {
			const win = frame.frame.contentWindow;
			const title = win.document.title;
			if (title && title !== "Scramjet") {
				tab.title = title;
				tabEl.querySelector(".tab-title").textContent = title;
			}
			
			// Try to get the current URL from the frame if possible
			// Scramjet usually puts the original URL in some property or we can infer it
			if (win.location.pathname.startsWith("/scram/")) {
				// This is a bit tricky depending on scramjet version
				// But we can at least update the address bar if this is the active tab
				if (activeTabId === id) {
					updateAddressBar(tab);
				}
			}
		} catch (e) {
			// Cross-origin might prevent reading title
		}
	});

	// Listen for title changes via message (if scramjet supports it)
	window.addEventListener("message", (event) => {
		if (event.source === frame.frame.contentWindow) {
			if (event.data.type === "title") {
				tab.title = event.data.title;
				tabEl.querySelector(".tab-title").textContent = event.data.title;
			}
			if (event.data.type === "url") {
				tab.url = event.data.url;
				if (activeTabId === id) {
					navAddress.value = tab.url;
				}
			}
		}
	});

	return id;
}

async function loadUrlInTab(id, url) {
	const tab = tabs.find((t) => t.id === id);
	if (!tab) return;

	try {
		await registerSW();
	} catch (err) {
		error.textContent = "Failed to register service worker.";
		errorCode.textContent = err.toString();
		throw err;
	}

	let wispUrl =
		(location.protocol === "https:" ? "wss" : "ws") +
		"://" +
		location.host +
		"/wisp/";
	if ((await connection.getTransport()) !== "/libcurl/index.mjs") {
		await connection.setTransport("/libcurl/index.mjs", [
			{ websocket: wispUrl },
		]);
	}

	tab.url = url;
	tab.frame.go(url);
}

function updateAddressBar(tab) {
	if (tab && tab.url) {
		navAddress.value = tab.url;
	} else {
		navAddress.value = "";
	}
}

function switchTab(id) {
	activeTabId = id;
	const activeTab = tabs.find(t => t.id === id);
	
	tabs.forEach((t) => {
		if (t.id === id) {
			t.tabEl.classList.add("active");
			t.frame.frame.classList.add("active");
		} else {
			t.tabEl.classList.remove("active");
			t.frame.frame.classList.remove("active");
		}
	});

	if (id === null || (activeTab && !activeTab.url)) {
		home.classList.remove("hidden");
		if (activeTab) {
			activeTab.frame.frame.classList.remove("active");
		}
	} else {
		home.classList.add("hidden");
	}
	
	updateAddressBar(activeTab);
}

function closeTab(id) {
	const index = tabs.findIndex((t) => t.id === id);
	if (index === -1) return;

	const tab = tabs[index];
	tab.tabEl.remove();
	tab.frame.frame.remove();
	tabs.splice(index, 1);

	if (activeTabId === id) {
		if (tabs.length > 0) {
			switchTab(tabs[Math.max(0, index - 1)].id);
		} else {
			switchTab(null);
		}
	} else if (tabs.length === 0) {
		switchTab(null);
	}
}

addTabBtn.addEventListener("click", () => {
	createTab();
});

homeBtn.addEventListener("click", () => {
	const tab = tabs.find(t => t.id === activeTabId);
	if (tab) {
		tab.url = null;
		tab.title = "New Tab";
		tab.tabEl.querySelector(".tab-title").textContent = "New Tab";
		// We don't remove the frame, just hide it
		switchTab(activeTabId);
	} else {
		createTab();
	}
});

backBtn.addEventListener("click", () => {
	const tab = tabs.find(t => t.id === activeTabId);
	if (tab && tab.frame) {
		tab.frame.frame.contentWindow.history.back();
	}
});

forwardBtn.addEventListener("click", () => {
	const tab = tabs.find(t => t.id === activeTabId);
	if (tab && tab.frame) {
		tab.frame.frame.contentWindow.history.forward();
	}
});

reloadBtn.addEventListener("click", () => {
	const tab = tabs.find(t => t.id === activeTabId);
	if (tab && tab.frame) {
		tab.frame.frame.contentWindow.location.reload();
	}
});

navForm.addEventListener("submit", async (event) => {
	event.preventDefault();
	const url = search(navAddress.value, searchEngine.value);
	if (activeTabId) {
		await loadUrlInTab(activeTabId, url);
		switchTab(activeTabId);
	} else {
		await createTab(url);
	}
});

form.addEventListener("submit", async (event) => {
	event.preventDefault();
	const url = search(address.value, searchEngine.value);
	address.value = "";
	if (activeTabId) {
		const tab = tabs.find(t => t.id === activeTabId);
		if (tab && !tab.url) {
			await loadUrlInTab(activeTabId, url);
			switchTab(activeTabId);
			return;
		}
	}
	await createTab(url);
});

// Initialize with a new tab if none
if (tabs.length === 0) {
	createTab();
}
