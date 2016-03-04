var net = require('net');
var glob = require('./helpers/Constants').glob;

var TorSocket = require('./TorSocket').TorSocket;
var TorConnector = require('./TorConnector').TorConnector;
var routers = require('./RouterManager');

var TOR_PORT = glob.TOR_PORT;
var MAX_ID = glob.MAX_ID;

// socket ID 0 and 1 are reserved for HTTP connection managers
var nextSocketID = 2;

var torServer = net.createServer(function(socket) {
	var torSocket = new TorSocket(socket, nextSocketID);
	nextSocketID = (nextSocketID + 1) % MAX_ID;
	new TorConnector(torSocket, false, routers.registerConnection);
});

torServer.listen(TOR_PORT, function(err) {
	if(err) throw err;
	console.log("Tor server listening on " + torServer.address().address + ":" + torServer.address().port);
});

// Called when a TorSocket connection wrapper wants to relay data to a connection
// it does not already have a circuit set up with.
function getConnection(agent, connectionInfo, responseHandler) {

	var failResponse = function() {
		agentSocket.removeListener('error', failResponse);
		agentSocket.removeListener('close', failResponse);
		responseHandler('failure');
	};

	// if we already have an open TorSocket to the agent
	if(routers.isExistingConnection(agent)) {
		responseHandler('success', routers.isExistingConnection(agent));
	} else {
		var agentSocket = net.createConnection(connectionInfo, function() {
			var torSocket = new TorSocket(agentSocket, nextSocketID);
			nextSocketID = (nextSocketID + 1) % MAX_ID;
			new TorConnector(torSocket, agent, function(status, establisher, agent) {
				if(status === 'success') {
					routers.registerConnection('success', establisher, agent);
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

module.exports = {
	getConnection : getConnection
}