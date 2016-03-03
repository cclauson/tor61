var glob = require('./helpers/Constants').glob;
var registration = require('./registration/Registration');

var TOR_PORT = glob.TOR_PORT;
var MY_AGENT = glob.MY_AGENT;
var MY_GROUP = glob.MY_GROUP;
var MY_INSTANCE = glob.MY_INSTANCE;

// array of available tor routers
var availableRouters;

// map from agent to establisher for ports function
var existingConnections = {};

function getRandomRouter() {
	var index = Math.floor(Math.random() * availableRouters.length);
	return availableRouters[index];
}

function isExistingConnection(agent) {
	return (existingConnections[agent]) ? existingConnections[agent] : false;
}

// Called when a new socket is created with us as the openee
function registerConnection(status, establisher, agent) {
	// Special case: ignore if self loop. This is the only case where
	// we may have multiple TCP connections to the same router. In this
	// case, we want to keep the value in existingConnections so the same socket
	// will always be the establisher in all self-loop communication.
	if(establisher && (agent !== MY_AGENT)) {
		existingConnections[agent] = establisher;
	}
}

function removeConnection(agent) {
	delete existingConnections[agent];
}

function padZero(num, digits) {
	return String('00000000'+num.toString(16)).slice(-digits);
}

// Register this router on the network
var group = padZero(MY_GROUP, 4);
var instance = padZero(MY_INSTANCE, 4);

registration.register(TOR_PORT, MY_AGENT, "Tor61Router-" + group + "-" + instance, function(status) {
	if(status) {
		// Update our list of available routers every 5 minutes
		var setRouters = function(data) {
			console.log(data);
			if(data) {
				availableRouters = data;
			} else {
				console.log("Unable to reach registration service");
			}
			setTimeout(function() {
				registration.fetch("Tor61Router-" + group, setRouters);
			}, 5 * 60 * 1000);
		}
		registration.fetch("Tor61Router-" + group, setRouters);
	} else {
		console.log("Unable to reach registration service for initial fetch. Exiting.");
		process.exit();
	}
});

module.exports = {
	getRandomRouter : getRandomRouter,
	isExistingConnection : isExistingConnection,
	registerConnection : registerConnection,
	removeConnection : removeConnection
}