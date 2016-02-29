var types = require('./helpers/Constants').types;
var readOps = require('./helpers/CellReadOperations');
var modifyCircuitID = require('./helpers/CellMakeOperations').modifyCircuitID;

// Handles the creation and management of circuits that go out to another
// router through this socket.
function TorEstablisher(torSocket, isOpener) {
	var nextID = (isOpener) ? 1 : 2;

	// Which circuit number we should replace the existing circuit with
	// key(socketID, currentNum) -> newNum 
	var outgoingRoutingTable = {};

	// Functions to handle responses for each circuit that this socket
	// is in charge of
	// socketID -> function
	// POTENTIALLY REPLACE WITH socketID -> (function, isWaiting)
	var incomingRoutingTable = {};

	this.isMyCircuit = function(circuitNum) {
		return((incomingRoutingTable[circuitNum]) ? true : false);
	};

	this.registerHandler = function(oldCircuitID, messagingSocketID, responseHandler) {
		var key = generateKey(oldCircuitID, messagingSocketID);

		// Housekeeping functions to piggyback onto the responseHandler
		// Mostly for removing entries in the routing table if we get
		// certain responses.
		var responseHousekeeping = function(status, message) {
			// if the message we're receiving back is of type destroy
			if(readOps.getType(message) === types.destroy || readOps.getType(message) === types.create_failed) {
				deleteCircuit(oldCircuitID, messagingSocketID);
			}
		}

		outgoingRoutingTable[key] = nextID;

		incomingRoutingTable[nextID] = function(status, message) {
			responseHousekeeping(status, message);
			responseHandler(status, message);
		};

		nextID = (nextID + 2) % MAX_ID;
	};

	this.sendMessage = function(messagingSocketID, message) {
		// get the current circuit number. If we don't have an entry for that circuit and
		// the messaging socket id, fail. Otherwise, send the message (with new circuit number)
		// over the socket. Make entry in incomingRouting table between circuitNum and responseHandler
		// If no responseHandler is passed in, retain the current one. This is only really useful once
		// a circuit is set up and we want to reuse the handler for sending data back and forth
		var oldCircuitID = readOps.getCircuit(message);
		var newCircuitID = outgoingRoutingTable[generateKey(oldCircuitID, messagingSocketID)];

		var postWriteCallback;

		if(isNaN(newCircuitID)) {
			throw new Error("Did not register handler before sending message");
		}

		// If the message we're sending is of type destroy, delete the circuit
		// after passing along the message
		if(readOps.getType(message) === types.destroy) {
			postWriteCallback = function() {
				deleteCircuit(oldCircuitID, messagingSocketID);
			};
		}

		// Update the circuit id
		modifyCircuitID(message, newCircuitID);

		// Send the message
		torSocket.write(message, postWriteCallback);
		
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