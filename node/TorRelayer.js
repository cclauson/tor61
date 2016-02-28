var constants = require('./helpers/Constants');
var readOps = require('./helpers/CellReadOperations');
var makeOps = require('./helpers/CellMakeOperations');
var checkOps = require('./helpers/CellCheckOperations');
var factory = require('./TorSocketFactory');

var types = constants.types;
var relayTypes = constants.relayTypes;

// Handles the creation and management of circuits that go in from another
// router through this socket.
function TorRelayer(torSocket) {
	// Which Tor/Http socket to send information we receive on this socket to
	// circuitNum -> socketID
	var incomingRoutingTable = {};

	this.handleMessage = function(message) {
		// Check that we have an entry in our routing table
		// for this circuit. If we do, send it along.
		// If we don't, make sure it's something valid to send
		// as a first message like a create.

		// DEAL WITH CREATES, RELAYS THAT WE SEND THROUGH, AND RELAYS THAT END WITH US
		sendMessage(message, /*correct responseHandler*/);
		// part of responseHandler should be to add to incomingRoutingTable
	}

	function handleRelay(message, responseHandler) {
		var circuitNum = readOps.getCircuit(message);
		if(incomingRoutingTable[circuitNum]) {
			incomingRoutingTable[circuitNum](message, torSocket.getID(), responseHandler);
		} else {
			// Some kind of failure. If this isn't a relay extend, we should have
			// some record of the circuit in here
		}
	}

	function handleRelayExtend(message, responseHandler) {
		var circuitNum = readOps.getCircuit(message);
		// responseHandler in this case should do a create handshake, with code to
		// send correct response back up in the callback to the sendMessage
		factory.getConnection(/*agent*/, responseHandler);
	}

	function handleCreate(message, responseHandler) {

	}

}

module.exports = {
	TorRelayer : TorRelayer
};