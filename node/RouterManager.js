var glob = require('./helpers/Constants').glob;
var registration = require('./registration/Registration');

var TOR_PORT = glob.TOR_PORT;
var MY_AGENT = glob.MY_AGENT;
var MY_GROUP = glob.MY_GROUP;
var MY_INSTANCE = glob.MY_INSTANCE;

// array of available tor routers
var availableRouters = [];

// map from agent to establisher for ports function
var existingConnections = {};

// setInterval(function() {
// 	console.log(Object.keys(existingConnections));
// }, 2000);

var initialFetchCompleted = false;
var initialCallback;

function getRandomRouter(invalidList) {

	var usefulRouters;

	// If we're passed in an invalid list, only consider entries not in invalidList
	if(invalidList && invalidList.length > 0) {
		usefulRouters = availableRouters.filter(function(val) {
			return invalidList.indexOf(val) === -1;
		});
	} else {
		usefulRouters = availableRouters;
	}

	// Return connection information for this router if we don't have record of any
	// other routers. This should only happen if there's an issue with the registration
	// service or our connection to the registration service - this behavior is better
	// than crashing or erroring.
	if(usefulRouters.length === 0) {
		return {
			connectInfo : {
				ip : glob.TOR_IP,
				port : TOR_PORT
			},
			agent : MY_AGENT
		}
	}

	// Otherwise, just return a random router
	var randomVal = Math.random() * usefulRouters.length;
	var index = Math.floor(randomVal);
	return usefulRouters[index];
}

function isExistingConnection(agent) {
	return (existingConnections[agent]) ? existingConnections[agent] : false;
}

// Called when a new socket is created with us as the openee
function registerConnection(status, establisher, agent) {
	if(establisher) {
		existingConnections[agent] = establisher;
	}
}

function removeConnection(agent) {
	delete existingConnections[agent];
}

function initialSetupCallback() {
	if(typeof(initialCallback) === 'function') {
		initialCallback();
	}
}

function setInitialCallback(func) {
	if(initialFetchCompleted) {
		func();
	} else {
		initialCallback = func;
	}
}

function padZero(num, digits) {
	return String('00000000'+num.toString(16)).slice(-digits);
}

function printRouters(data) {
	console.log("Available Routers:");
	for(var i = 0; i < data.length; i++) {
		var router = data[i];
		var team = "0x" + padZero(router.agent >> 16, 4);
		var id = "0x" + padZero(router.agent & 0xFFFF, 4);
		console.log("\tTeam: " + team + ", ID: " + id + ", IP: " + router.connectInfo.ip + ", Port: " + router.connectInfo.port);
	}
}

// Register this router on the network
var group = padZero(MY_GROUP, 4);
var instance = padZero(MY_INSTANCE, 4);

var failCounter = 0;

function initialFetch() {
	registration.register(TOR_PORT, MY_AGENT, "Tor61Router-" + group + "-" + instance, function(status) {
		if(status) {
			// Update our list of available routers every 5 minutes
			var setRouters = function(data) {
				if(data) {
					availableRouters = data;
					printRouters(data);
					console.log();
				} else {
					console.log("Unable to reach registration service");
				}
				setTimeout(function() {
					registration.fetch("Tor61Router-" + group, setRouters);
				}, 5 * 60 * 1000);
			}
			registration.fetch("Tor61Router-" + group, function(data) {
				setRouters(data);
				initialFetchCompleted = true;
				initialSetupCallback();
			});
		} else {
			console.log("Unable to reach registration service for initial fetch. Retrying...");
			failCounter++;
			if(failCounter >= 3) {
				process.exit();
			}
			initialFetch();
		}
	});
}

initialFetch();

process.on('exit', function() {
	registration.unregister(TOR_PORT);
});

module.exports = {
	getRandomRouter : getRandomRouter,
	isExistingConnection : isExistingConnection,
	registerConnection : registerConnection,
	removeConnection : removeConnection,
	setInitialCallback : setInitialCallback
};