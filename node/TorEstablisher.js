var types = require('./helpers/Constants').types;
var readOps = require('./helpers/CellReadOperations');
var modifyCircuitID = require('./helpers/CellMakeOperations').modifyCircuitID;

// Handles the creation and management of circuits that go out to another
// router through this socket.
function TorEstablisher(torSocket, isOpener) {
	var nextID = (isOpener) ? 1 : 2;

	// Which circuit number we should replace the existing circuit with
	// socketID, currentNum -> newNum 
	var outgoingRoutingTable = {};

	// Functions to handle responses for each circuit that this socket
	// is in charge of
	// socketID -> function
	// POTENTIALLY REPLACE WITH socketID -> (function, isWaiting)
	var incomingRoutingTable = {};

	this.isMyCircuit = function(circuitNum) {
		return((incomingRoutingTable[circuitNum]) ? true : false);
	};

	this.sendMessage = function(message, messagingSocketID, responseHandler) {
		// get the current circuit number. If we don't have an entry for that circuit and
		// the messaging socket id, fail. Otherwise, send the message (with new circuit number)
		// over the socket. Make entry in incomingRouting table between circuitNum and responseHandler
		// If no responseHandler is passed in, retain the current one. This is only really useful once
		// a circuit is set up and we want to reuse the handler for sending data back and forth
		var oldCircuitID = readOps.getCircuit(message);
		var newCircuitID;

		var postWriteCallback;

		// Housekeeping functions to piggyback onto the responseHandler
		// Mostly for removing entries in the routing table if we get
		// certain responses.
		var preResponseHandler = function(status, message) {
			if(readOps.getType(message) === types.destroy) {
				deleteCircuit(oldCircuitID, messagingSocketID);
			}
		}

		// If this is a create
		if(readOps.getType(message) === types.create) {
			// Map this socket / circuit pair to a new circuit id
			outgoingRoutingTable[generateKey(oldCircuitID, messagingSocketID)] = nextID;
			newCircuitID = nextID;
			// Increment our next generated id
			nextID = (nextID + 2) % MAX_ID;
			// Modify the response handler so we clean up our created circuit if
			// we get a failure back.
			var preResponseHandlerTemp = preResponseHandler;
			preResponseHandler = function(status, message) {
				if(readOps.getType(message) === types.create_failed) {
					deleteCircuit(oldCircuitID, messagingSocketID);
				}
				preResponseHandlerTemp(status, message);
			};
		} else {
			// If it isn't, we should already have an id for it.
			newCircuitID = outgoingRoutingTable[generateKey(oldCircuitID, messagingSocketID)]
		}

		// If this is not a number, that means we got a message to a circuit that
		// was never created - fail in some way. This should never happen.
		if(isNaN(newCircuitID)) {
			if(responseHandler) {
				responseHandler('failure');
			}
		} else {

			// If the message is of type destroy, delete the circuit
			// after passing along the message
			if(readOps.getType(message) === types.destroy) {
				postWriteCallback = function() {
					deleteCircuit(oldCircuitID, messagingSocketID);
				};
			}

			// If a response handler was given
			if(responseHandler) {
				// replace the one we have with the new one
				incomingRoutingTable[newCircuitID] = function(status, message) {
					preResponseHandler(status, message);
					responseHandler(status, message);
				};
			} else if(!incomingRoutingTable[newCircuitID]) {
				incomingRoutingTable[newCircuitID] = preResponseHandler;
			}
			// If neither of these gets tripped, just keep the current response
			// handler. This will likely be used for relay data streaming

			// Update the circuit id
			modifyCircuitID(message, newCircuitID);

			// Send the message
			torSocket.write(message, postWriteCallback);
		}
		
	};

	this.handleResponse = function(message) {
		var circuitID = readOps.getCircuit(message);
		incomingRoutingTable[circuitID]('success', message);
	};

	// This is guaranteed to be unique since circuit ids can
	// only use two bytes.
	function generateKey(circuitID, socketID) {
		return (socketID << 16) + circuitID;
	}

	function deleteCircuit(oldCircuitID, messagingSocketID) {
		var oldKey = generateKey(oldCircuitID, messagingSocketID)
		var newID = outgoingRoutingTable[oldKey];
		delete outgoingRoutingTable[oldKey];
		delete incomingRoutingTable[newID]
	}

}

module.exports = {
	TorEstablisher : TorEstablisher
};