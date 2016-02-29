var readOps = require('./helpers/CellReadOperations');
var makeOps = require('./helpers/CellMakeOperations');
var checkOps = require('./helpers/CellCheckOperations');

var MY_AGENT = require('./helpers/Constants').glob.MY_AGENT;

var removeConnection = require('./TorConnectionManager').removeConnection;

var TorRelayer = require('./TorRelayer').TorRelayer;
var TorEstablisher = require('./TorEstablisher').TorEstablisher;

function TorConnector(torSocket, otherAgent, openHandshakeCallback) {

	// If this socket was spawned from another socket in our router, otherAgent
	// will be defined at this time. Otherwise, it was spawned from an incoming connection.
	// We could just evaluate otherAgent for truthyness, but I prefer this for clarity.
	var isOpener = (otherAgent) ? true : false;

	var relayer;
	var establisher;

	// We only get here if we're NOT the opener
	function handleOpen(message) {
		console.log('open callback');
		torSocket.removeListener('data', handleOpen);
		otherAgent = readOps.getOpenerAgent(message);
		// if is open cell
		if(checkOps.validateOpen(message, otherAgent, MY_AGENT)) {
			var openedCell = makeOps.constructOpened(otherAgent, MY_AGENT);
			torSocket.write(openedCell);
			openFinishedCallback('success');
		} else {
			var openFailedCell = makeOps.constructOpenFailed(otherAgent, MY_AGENT);
			torSocket.write(openFailedCell, function() {
				torSocket.close();
			});
		}
	}

	// We only get here if we ARE the opener
	function handleOpened(message) {
		console.log('opened callback');
		torSocket.removeListener('data', handleOpened);
		// if message is an open response
		if(checkOps.validateOpened(message, MY_AGENT, otherAgent)) {
			openFinishedCallback('success');
		} else {
			// kill this socket
			torSocket.close();
			openFinishedCallback('failure');
		}
	}

	// Notifies our callback of whether the open handshake succeeded
	// If it succeeded, switches us into normal message handling mode
	function openFinishedCallback(status) {
		if(status === 'success') {
			relayer = new TorRelayer(torSocket);
			establisher = new TorEstablisher(torSocket, isOpener);
			torSocket.on('close', function() {
				removeConnection(otherAgent);
				relayer.cleanup();
				establisher.cleanup();
			});
			openHandshakeCallback('success', establisher, otherAgent);
			torSocket.on('data', normalMessageHandler);
		} else {
			openHandshakeCallback(status);
		}
	}

	// Determines whether the message should be handled by establisher
	// or relayer
	function normalMessageHandler(message) {

		if(establisher.isMyCircuit(readOps.getCircuit(message))) {
			// This is a response on one of establisher's circuits
			// Send to establisher
			establisher.handleResponse(message);
		} else {
			// This isn't one of the circuits we're actively managing,
			// send to relayer
			relayer.handleMessage(message);
		}

	}

	// openHandshakeCallback is from a getSocket call
	if(isOpener) {
		var openCell = makeOps.constructOpen(MY_AGENT, otherAgent);
		torSocket.write(openCell);
		torSocket.on('data', handleOpened);
	// openHandshakeCallback is a registerNewSocket call
	} else {
		torSocket.on('data', handleOpen);
	}

}

// var TorRelayer = function(socket) {
// 	this.handleMessage = function(message) {
// 		console.log("MESSAGE RELAYED:");
// 		console.log(message);
// 	}
// };

// var TorEstablisher = function(socket, isOpener) {
// 	this.isMyCircuit = function(circuitID) {
// 		return false;
// 	};

// 	this.handleResponse = function(message) {
// 		console.log("MESSAGE ESTABLISHED:");
// 		console.log(message);
// 	}
// };

module.exports = {
	TorConnector : TorConnector
};