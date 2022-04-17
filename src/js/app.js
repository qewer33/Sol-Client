const Launcher = require("./launcher");
const Utils = require("./utils");
const Config = require("./config");
const launcher = Launcher.instance;
const { ipcRenderer, shell } = require("electron");
const { MicrosoftAuthService, YggdrasilAuthService, Account, AccountManager } = require("./auth");
const microsoftAuthService = MicrosoftAuthService.instance;
const yggdrasilAuthService = YggdrasilAuthService.instance;
const fs = require("fs");
const msmc = require("msmc");
const os = require("os");
const nbt = require("nbt");
const vm = require("vm");
const url = require("url");
const path = require("path");
const axios = require("axios");


Utils.init();
Config.init(Utils.minecraftDirectory);
Config.load();

ipcRenderer.on("close", (event) => {
	ipcRenderer.send("quit", launcher.games.length < 1);
});

ipcRenderer.on("quitGame", (event) => {
	for(game of launcher.games) {
		game.kill();
	}
	launcher.games = [];
	ipcRenderer.send("quit", true);
});

window.addEventListener("DOMContentLoaded", () => {
	if(Utils.getOsName() == "osx") {
		document.querySelector(".drag-region").style.display = "block";
	}

	const windowBackground = document.getElementById("window-background");

	const minimizeButton = document.getElementById("minimize-button");
	const maximizeButton = document.getElementById("maximize-button");
	const closeButton = document.getElementById("close-button");

	const playButton = document.getElementById("launch-button");
	const launchNote = document.getElementById("launch-note");
	const microsoftLoginButton = document.querySelector(".microsoft-login-button");
	const mojangLoginButton = document.querySelector(".mojang-login-button");
	const accountButton = document.querySelector(".account-button");

	const login = document.querySelector(".login");
	const mojangLogin = document.querySelector(".mojang-login");
	const main = document.querySelector(".main");
	const accounts = document.querySelector(".accounts");
	const backToMain = document.querySelector(".back-to-main-button");
	const newsContent = document.querySelector(".news-content");

	const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

	minimizeButton.onclick = () => {
		ipcRenderer.send("minimize");
	}

	maximizeButton.onclick = () => {
		ipcRenderer.send("maximize");
	}

	closeButton.onclick = () => {
		ipcRenderer.send("quit", launcher.games.length < 1);
	}

	fetch("https://sol-client.github.io/news.html", {
				headers: {
					"Cache-Control": "no-cache"
				}
			})
			.then(async(response, error) => {
				var today = new Date();

				newsContent.innerHTML = "<br/>" + await response.text();
				for(var timeElement of newsContent.getElementsByTagName("time")) {
					var datetime = timeElement.getAttribute("datetime");

					if(datetime == "future") {
						timeElement.innerText = "The Future";
						continue;
					}

					var todayYear = today.getFullYear();
					var todayMonth = today.getMonth() + 1;
					var todayDay = today.getDate();

					var year = parseInt(datetime.substring(0, 4));
					var month = parseInt(datetime.substring(5, 7));
					var day = parseInt(datetime.substring(8, 10));

					if(todayYear == year && todayMonth == month) {
						if(todayDay == day) {
							timeElement.innerText = "Today";
							continue;
						}
						else if(todayDay - 1 == day) {
							timeElement.innerText = "Yesterday";
							continue;
						}
					}


					var friendlyName = "";

					friendlyName += day;

					var lastDigit = day % 10;

					if(lastDigit == 1) {
						friendlyName += "st";
					}
					else if(lastDigit == 2) {
						friendlyName += "nd";
					}
					else if(lastDigit == 3) {
						friendlyName += "rd";
					}
					else {
						friendlyName += "th";
					}

					friendlyName += " " + monthNames[month - 1];

					if(today.getFullYear() != year) {
						friendlyName += " " + year;
					}

					timeElement.innerText = friendlyName;
				}
			})
			.catch((error) => {
				console.error(error);
				news.innerHTML = `<p>${error}</p>`;
			});

	launcher.accountManager = new AccountManager(Utils.accountsFile, (account) => {
		if(account == launcher.accountManager.activeAccount) {
			updateAccount();
		}

		if(accounts.style.display) {
			updateAccounts();
		}
	});

	function updateAccount() {
		document.querySelector(".account-button").innerHTML = `<img src="${launcher.accountManager.activeAccount.head}"/> <span>${launcher.accountManager.activeAccount.username} <img src="../svg/arrow.svg" class="arrow-icon"/></span>`;
	}

	function updateMinecraftFolder() {
		document.querySelector(".minecraft-folder-path").innerText = Config.data.minecraftFolder;
	}

	updateMinecraftFolder();

	backToMain.onclick = () => {
		if(loggingIn) {
			return;
		}

		login.classList.add("invisible");
		main.classList.remove("invisible");
	};

	if(launcher.accountManager.activeAccount != null) {
		main.classList.remove("invisible");
		updateAccount();
	}
	else {
		login.classList.remove("invisible");
		backToMain.classList.add("invisible");
	}

	var launching = false;
	var loggingIn = false;

	document.onmousedown = (event) => {
		if(!main.style.display) {
			return;
		}

		if(!accounts.contains(event.target) && !accountButton.contains(event.target)) {
			accounts.classList.remove("invisible");
		}
	};

	function updateAccounts() {
		accounts.innerHTML = "";

		for(let account of launcher.accountManager.accounts) {
			var accountElement = document.createElement("div");
			accountElement.classList.add("account");
			accountElement.innerHTML = `<img src="${account.head}"/> <span>${account.username}</span> <button class="remove-account"><img src="../svg/remove.svg"/></button>`;
			accountElement.onclick = (event) => {
				if(event.target.classList.contains("remove-account")
						|| event.target.parentElement.classList.contains("remove-account")) {
					if(!launcher.accountManager.removeAccount(account)) {
						main.classList.add("invisible");;
						login.classList.remove("invisible");;
						backToMain.classList.add("invisible");
					}
					else {
						updateAccounts();
					}
				}
				else {
					launcher.accountManager.switchAccount(account);
					accounts.classList.add("invisible");
				}
				updateAccount();
			};
			accounts.appendChild(accountElement);
		}

		var addElement = document.createElement("div");
		addElement.classList.add("account");
		addElement.innerHTML = `<img src="../svg/add.svg"/> <span>Add Account</span>`;
		addElement.onclick = () => {
			main.classList.add("invisible");
			login.classList.remove("invisible");
			backToMain.classList.remove("invisible");
		};

		accounts.appendChild(addElement);

		accounts.classList.remove("invisible");
	}

	accountButton.onclick = () => {
		if(!accounts.classList.contains("invisible")) {
			accounts.classList.add("invisible");
			return;
		}

		updateAccounts();
	};

	microsoftLoginButton.onclick = () => {
		if(!loggingIn) {
			loggingIn = true;
			microsoftLoginButton.innerText = "...";
			ipcRenderer.send("msa");
		}
	};

	ipcRenderer.on("msa", (event, result) => {
		loggingIn = false;
		microsoftLoginButton.innerText = "Microsoft Account";
		result = JSON.parse(result);
		if(msmc.errorCheck(result)) {
			if(result.type == "Cancelled") {
				return;
			}
			alert("Could not log in: " + result.type);
			return;
		}
		var account = microsoftAuthService.authenticate(result.profile);
		launcher.accountManager.addAccount(account);
		login.classList.add("invisible");
		main.classList.remove("invisible");
		updateAccount();
		updateAccounts();
	});

	mojangLoginButton.onclick = () => {
		if(!loggingIn) {
			login.classList.add("invisible");
			mojangLogin.classList.remove("invisible");
		}
	};

	async function play(server) {
		if(!launching) {
			launching = true;

			if(!fs.existsSync(Utils.assetsDirectory)) {
				launchNote.style.display = "inline";
			}

			playButton.innerText = "...";
			try {
				await launcher.accountManager.refreshAccount(launcher.accountManager.activeAccount);
			}
			catch(error) {
				console.error(error);
				if(launcher.accountManager.activeAccount) {
					updateAccount();
				}

				main.classList.add("invisible");
				login.classList.remove("invisible");
				if (launcher.accountManager.accounts.length > 0)
					backToMain.classList.remove("invisible");
				else
					backToMain.classList.remove("add");
				playButton.innerText = "Play";
				launching = false;
				return;
			}
			launcher.launch(() => {
				playButton.innerText = "Play";
				launching = false;
				launchNote.style.display = null;
			}, server);
		}
	}

	playButton.onclick = () => play();

	document.querySelector(".back-to-login-button").onclick = () => {
		mojangLogin.classList.add("invisible");
		login.classList.remove("invisible");
	};

	document.querySelector(".about-tab").onclick = () => switchToTab("about");
	document.querySelector(".settings-tab").onclick = () => switchToTab("settings");
	document.querySelector(".news-tab").onclick = () => switchToTab("news");
	document.querySelector(".minecraft-folder").onclick = () => ipcRenderer.send("directory");

	ipcRenderer.on("directory", (event, file) => {
		Config.data.minecraftFolder = file;
		Config.save();
		updateMinecraftFolder();
		updateServers();
	});

	document.querySelector(".devtools").onclick = () => ipcRenderer.send("devtools");

	function updateServers() {
		var serversList = document.querySelector(".quick-servers");
		var serversFile = Config.getGameDirectory(Utils.gameDirectory) + "/servers.dat";
		var serverText = document.querySelector(".quick-join-text");

		if(fs.existsSync(serversFile)) {
			nbt.parse(fs.readFileSync(serversFile), (error, data) => {
				if(error) {
					throw error;
				}

				var servers = data.value.servers.value.value;

				if(servers.length > 0) {
					serversList.innerHTML = "";
				}

				for(var i = 0; i < servers.length && i < 5; i++) {
					 // first time I've ever needed to use the let keyword
					let server = servers[i];
					let serverIndex = i;

					let serverElement = document.createElement("span");

					serverElement.onmouseenter = () => {
						serverText.innerText = server.name.value;
					};

					serverElement.onmouseout = () => {
						serverText.innerText = "Play Server";
					};

					serverElement.onclick = () => {
						play("§sc§" + serverIndex);
					}

					serverElement.classList.add("server");
					serverElement.innerHTML = `
						${server.icon ? `<img src="data:image/png;base64,${server.icon.value}"/>` : `<img src="../svg/unknown_server.svg"/>`}`;

					serversList.appendChild(serverElement);
				}
			});
		}
	}
	updateServers();

	var memory = document.querySelector(".memory");
	var memoryLabel = document.querySelector(".memory-label");

	memory.max = os.totalmem() / 1024 / 1024;
	memory.value = Config.data.maxMemory;

	var optifine = document.querySelector(".optifine");
	optifine.checked = Config.data.optifine;
	optifine.onchange = () => {
		Config.data.optifine = optifine.checked;
		Config.save();
	}

	var discord = document.querySelector(".discord");
	discord.checked = Config.data.discord;
	discord.onchange = () => {
		Config.data.discord = discord.checked;
		Config.save();
	}

	function updateMemoryLabel() {
		memoryLabel.innerText = (memory.value / 1024).toFixed(1) + " GB";
		Config.data.maxMemory = memory.value;
	}

	memory.oninput = updateMemoryLabel;
	memory.onchange = Config.save;

	updateMemoryLabel();

	var currentTab = "about";

	function switchToTab(tab) {
		document.querySelector("." + currentTab).classList.add("invisible");

// 		playButton.classList.add("invisible");

		document.querySelector(".about-tab").classList.remove("selected-tab");
		document.querySelector(".settings-tab").classList.remove("selected-tab");
		document.querySelector(".news-tab").classList.remove("selected-tab");
		document.querySelector("." + tab).classList.remove("invisible");
		document.querySelector("." + tab + "-tab").classList.add("selected-tab");

		currentTab = tab;
	}

	const loginButtonMojang = document.querySelector(".login-button-mojang");
	const emailField = document.getElementById("username");
	const passwordField = document.getElementById("password");
	const errorMessage = document.querySelector(".error-message");

	loginButtonMojang.onclick = async() => {
		if(!loggingIn) {
			loggingIn = true;
			loginButtonMojang.innerText = "...";
			try {
				var account = await yggdrasilAuthService.authenticateUsernamePassword(emailField.value, passwordField.value);
				launcher.accountManager.addAccount(account);
				mojangLogin.style.display = "none";
				main.style.display = "block";
				emailField.value = "";
				passwordField.value = "";
				errorMessage.innerText = "";
				updateAccount();
				updateAccounts();
			}
			catch(error) {
				errorMessage.innerText = "Could not log in";
			}
			loginButtonMojang.innerText = "Log In";
			loggingIn = false;
		}
	};

	for(var element of document.querySelectorAll(".open-in-browser")) {
		const href = element.href;
		element.href = "javascript:void(0);";
		element.onclick = function(event) {
			shell.openExternal(href);
		};
	}
});
