var net = require('net');

var constants = require('./helpers/Constants');

var registration = require('./registration/Registration');
var TorSocket = require('./TorSocket').TorSocket;
var TorConnector = require('./TorConnector').TorConnector;

var id = 1;

// map from agent to connection info
var availableRouters;

var torPort = parseInt(process.argv[2]);
var instanceNum = parseInt(process.argv[3]);
MY_AGENT = (MY_GROUP << 16) + instanceNum;

// map from agent to establisher for ports function
var existingConnections = {};

var torServer = net.createServer(function(socket) {
	var torSocket = new TorSocket(socket, id);
	id = (id + 1) % MAX_ID;
	new TorConnector(torSocket, false, registerConnection);
});

torServer.listen(torPort, function(err) {
	if(err) throw err;
	console.log("Tor server listening on " + torServer.address().address + ":" + torServer.address().port);
});

function updateAvailableRouters(newAvailableRouters) {
	availableRouters = newAvailableRouters;
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

// Called when a TorSocket connection wrapper wants to relay data to a connection
// it does not already have a circuit set up with.
function getConnection(agent, connectionInfo, responseHandler) {

	var failResponse = function() {
		agentSocket.removeListener('error', failResponse);
		agentSocket.removeListener('close', failResponse);
		responseHandler('failure');
	};

	// if we already have an open TorSocket to the agent
	if(existingConnections[agent]) {
		responseHandler('success', existingConnections[agent]);
	} else {
		var agentSocket = net.createConnection(connectionInfo, function() {
			var torSocket = new TorSocket(agentSocket, id);
			id = (id + 1) % MAX_ID;
			agentSocket.on('error', failResponse);
			agentSocket.on('close', failResponse);
			new TorConnector(torSocket, agent, function(status, establisher, agent) {
				if(status === 'success') {
					existingConnections[agent] = establisher;
					responseHandler('success', establisher);
				} else {
					// handshake was not accepted by agent, call responseHandler with error
					responseHandler('failure');
				}
				agentSocket.removeListener('error', failResponse);
				agentSocket.removeListener('close', failResponse);
			});
		});
		agentSocket.on('error', failResponse);
		agentSocket.on('close', failResponse);
	}
}

// Register this router on the network
var group = padZero(MY_GROUP, 4);
var instance = padZero(instanceNum, 4);
registration.register(torServer.address().port, MY_AGENT, "Tor61Router-" + group + "-" + instance, function(status) {
	if(status) {
		// Update our list of available routers every 10 minutes
		var setRouters = function(data) {
			if(data) {
				availableRouters = data;
				setTimeout(function() {
					registration.fetch("Tor61Router-" + group, setRouters);
				}, 10 * 60 * 1000);
			} else {
				// Registration service cannot be contacted. Destroy everything.
			}
		}
		registration.fetch("Tor61Router-" + group, setRouters);
	} else {
		// Registration service cannot be contacted. Destroy everything.
	}
});

function padZero(num, digits) {
	return String('00000000'+num.toString(16)).slice(-digits);
}

module.exports = {
	updateAvailableRouters : updateAvailableRouters,
	registerConnection : registerConnection,
	getConnection : getConnection,
	removeConnection : removeConnection
}