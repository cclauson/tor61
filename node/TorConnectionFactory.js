var net = require('net');

var TorSocket = require('./TorSocket').TorSocket;
var TorConnector = require('./TorConnector').TorConnector;

// map from agent to connection info
var availableRouters = initialAvailableRouters;

// map from agent to sendMessage function
var existingConnections = {};

function updateAvailableRouters(newAvailableRouters) {
	availableRouters = newAvailableRouters;
}

// Called when a new socket is created with us as the openee
function registerNewConnection(messageFunction, agent) {
	// Special case: ignore if self loop. This is the only case where
	// we may have multiple TCP connections to the same router. In this
	// case, we want to keep the value in existingConnections so the same socket
	// will always be the establisher in all self-loop communication.
	if(messageFunction && (agent !== MY_AGENT)) {
		existingConnections[agent] = messageFunction;
	}
}

// Called when one socket wants to send something to an agent
// that is not the one it is connected to
function getConnection(agent, responseHandler) {
	// if we already have an open TorSocket to the agent
	if(existingConnections[agent]) {
		responseHandler('success', existingConnections[agent]);
	} else {
		var agentSocket = net.createConnection(availableRouters[agent], function() {
			var torSocket = new TorSocket(agentSocket, getNewSocketID());
			new TorConnector(torSocket, agent, function(status, messageFunction, agent) {
				if(status === 'success') {
					existingConnections[agent] = messageFunction;
					responseHandler('success', messageFunction);
				} else {
					// handshake was not accepted by agent, call responseHandler with error
					responseHandler('failure');
				}
			});
		});

		agentSocket.on('error', function() {
			// was unable to connect to agent, call responseHandler with error
			responseHandler('failure');
		});
	}
}

module.exports = {
	updateAvailableRouters : updateAvailableRouters,
	registerNewConnection : registerNewConnection,
	getConnection : getConnection,
}