// This connects an HTTP endpoint and the tor network
// by creating an HTTP stream, packaging data in tor
// data cells, and sending them over

// Potentially also creates a circuit if the current one
// is down.

// streamID -> array of queued requests
var queuedRequests = {};

var socketID = 0;

var circuitID = 0;

var COMPLETED_CIRCUIT_LENGTH = 3;
var circuitEntry;
var circuitLength = 0;

function createFirstHop() {
	circuitID++;
	var router = getRandomRouter();
	getConnection(router.agent, router.connectInfo, function(status, establisher) {
		if(status === 'failure') {
			createFirstHop();
			return;
		} else {
			var create = makeOps.constructCreate(circuitID);
			establisher.registerHandler(circuitID, socketID, function(status, message) {
				responseHandler(status, message, establisher);
			});
			establisher.sendMessage(socketID, create);
		}
	});
}

function extendCircuit() {
	var router = getRandomRouter();
	var extendBody = makeOps.constructRelayBody(router.connectInfo.host, router.connectInfo.port, router.agent);
	var extend = makeOps.constructRelayExtend(circuitID, extendBody);
	circuitEntry.sendMessage(extend);
}

function responseHandler(status, message, establisher) {
	if(status === 'success') {
		var type = readOps.getType(message);
		if(type === types.relay) {
			var relayType = readOps.getRelayCommand(message);
			if(relayType === relayTypes.data) {
				// received data
			} else if(relayType === relayTypes.connected) {
				// success for stream creation
				// send everything in request queue for this streamID
			} else if(relayType === relayTypes.begin_failed) {
				// failure for stream creation
			} else if(relayType === relayTypes.extended) {
				// success for extended
				circuitLength++;
				if(circuitLength < COMPLETED_CIRCUIT_LENGTH) {
					extendCircuit();
				} else {
					// circuit is complete
					// send out entire request queue
				}
			} else if(relayType === relayTypes.extend_failed) {
				// failure for extended
				extendCircuit();
			}
		} else if(type === types.created) {
			// success for first hop
			circuitEntry = establisher;
			circuitLength = 1;
			extendCircuit();
		} else if(type === types.create_failed) {
			// failure for first hop
			createFirstHop();
		}
	} else if(status === 'ended') {
		circuitEntry = undefined;
		circuitLength = 0;
		createFirstHop();
	}
}

function sendMessage(cell, streamID) {
	// Check if queuedRequests has the stream initialized
	// if it doesn't, create stream by sending begin, fire out
	// queued requests

	queuedRequests[streamID] = queuedRequests[streamID] || [];
	queuedRequests[streamID].push(cell);
	if(/*We have a complete circuit*/) {
		// send out entire queue
	}
}

createFirstHop();

module.exports = {
	sendMessage : sendMessage
};