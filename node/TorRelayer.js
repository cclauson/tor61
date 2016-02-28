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

	function handleRelay(message) {
		var circuitNum = readOps.getCircuit(message);
		// If we've already relayed 
		if(typeof(incomingRoutingTable[circuitNum]) === 'function') {
			// have a generic relay response handler, or one that switches based on message
			incomingRoutingTable[circuitNum](message, torSocket.getID(), responseHandler);
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
					// return an extend failed
				}
			});
		} else {
			// return an extend failed
		}
	}

	function destroyResponse(message) {
		if(readOps.getType(message) === types.destroy) {
			
		}
	}

	function handleRelayBegin(message) {
		// create our http connection
		// respond with a connected or begin failed
	}

	function handleRelayEnd(message) {
		// pass along the end command
	}

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

}

module.exports = {
	TorRelayer : TorRelayer
};