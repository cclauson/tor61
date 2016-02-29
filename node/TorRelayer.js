// ALL RESPONSE HANDLERS NEED TO HAVE A BRANCH THAT HANDLES
// RECEIVING A DESTROY MESSAGE

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
		var type = readOps.getType(message);
		if(type === types.relay) {
			handleRelay(message);
		} else if(type === types.create) {
			handleCreate(message);
		} else if(type === types.destroy) {
			handleDestroy(message);
		} else {
			console.log("invalid type: " + type);
		}
	};

	function handleDestroy(message) {
		var circuitID = readOps.getCircuit(message);
		var destination = incomingRoutingTable[circuitID];
		// If we have a circuit for this ID
		if(destination) {
			// Delete it from our records
			delete incomingRoutingTable[circuitID];
			// Pass it along
			destination(message, torSocket.getID());
		}
	}

	function handleCreate(message) {
		var circuitID = readOps.getCircuit(message);

		// primes our table
		incomingRoutingTable[circuitID] = 'primed'

		// returns a created response
		var created = makeOps.constructCreated(circuitID);
		torSocket.write(created);
	}

	function handleRelay(message) {
		var circuitNum = readOps.getCircuit(message);
		// If this circuit is already extended 
		if(typeof(incomingRoutingTable[circuitNum]) === 'function') {
			// have a generic relay response handler, or one that switches based on message
			incomingRoutingTable[circuitNum](message, torSocket.getID(), function(status, message) {
				if(status === 'success') {
					makeOps.modifyCircuitID(message, circuitNum);
					torSocket.write(message);
				}
			});
		} else {
			var relayType = readOps.getRelayCommand(message);
			if(relayType === relayTypes.begin) {
				handleRelayBegin(message);
			} else if(relayType === relayTypes.end) {
				handleRelayEnd(message);
			} else if(relayType === relayTypes.extend) {
				handleRelayExtend(message);
			}
		}

		if(readOps.getRelayCommand(message) === relayTypes.end) {
			delete incomingRoutingTable[circuitID];
		}
	}

	// These handlers only get called if we are the relay endpoint
	function handleRelayExtend(message) {
		var circuitNum = readOps.getCircuit(message);
		var destination = incomingRoutingTable[circuitNum];
		if(destination === 'primed') {
			// construct a create from the body, send to correct port based on agent
			factory.getConnection(getExtendAgent(message), function(status, senderFunction) {
				if(status === 'success') {
					// use senderFunction to send a create packet with a handler that
					// listens for a create success and relays it as a relay extended
					// and also adds us to incomingRoutingTable
					var create = makeOps.constructCreate(circuitNum);
					senderFunction(create, torSocket.getID(), function(status, response) {

					});
				} else {
					var streamID = readOps.getStreamID(message);
					var extendFailed = makeOps.contructRelayExtendFailed(circuitNum, streamID);
					torSocket.write(extendFailed);
				}
			});
		} else {
			var streamID = readOps.getStreamID(message);
			var extendFailed = makeOps.contructRelayExtendFailed(circuitNum, streamID);
			torSocket.write(extendFailed);
		}
	}

	function handleRelayBegin(message) {
		// create our http connection
		// respond with a connected or begin failed
		console.log("RELAY BEGINNING");
	}

	function handleRelayEnd(message) {
		// pass along the end command
		console.log("RELAY ENDING");
	}

}

module.exports = {
	TorRelayer : TorRelayer
};