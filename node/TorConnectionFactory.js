var net = require('net');

var TorSocket = require('./TorSocket').TorSocket;
var TorConnector = require('./TorConnector').TorConnector;

// map from agent to connection info
var availableRouters = initialAvailableRouters;

// map from agent to establisher for ports function
var existingConnections = {};

function updateAvailableRouters(newAvailableRouters) {
	availableRouters = newAvailableRouters;
}

// Called when a new socket is created with us as the openee
function registerNewConnection(establisher, agent) {
	// Special case: ignore if self loop. This is the only case where
	// we may have multiple TCP connections to the same router. In this
	// case, we want to keep the value in existingConnections so the same socket
	// will always be the establisher in all self-loop communication.
	if(establisher && (agent !== MY_AGENT)) {
		existingConnections[agent] = establisher;
	}
}

// Called when a TorSocket connection wrapper wants to relay data to a connection
// it does not already have a circuit set up with.
function getConnection(agent, connectionInfo, responseHandler) {
	// if we already have an open TorSocket to the agent
	if(existingConnections[agent]) {
		responseHandler('success', existingConnections[agent]);
	} else {
		var agentSocket = net.createConnection(connectionInfo, function() {
			var torSocket = new TorSocket(agentSocket, getNewSocketID());
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
	}

	var failResponse = function() {
		agentSocket.removeListener('error', failResponse);
		agentSocket.removeListener('close', failResponse);
		responseHandler('failure');
	};
}

module.exports = {
	updateAvailableRouters : updateAvailableRouters,
	registerNewConnection : registerNewConnection,
	getConnection : getConnection,
}