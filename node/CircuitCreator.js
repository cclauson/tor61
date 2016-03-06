var getConnection = require('./ConnectionManager').getConnection;
var getRandomRouter = require('./RouterManager').getRandomRouter;
var constants = require('./helpers/Constants');
var readOps = require('./helpers/CellReadOperations');
var makeOps = require('./helpers/CellMakeOperations');

var setInitialCallback = require('./RouterManager').setInitialCallback;

var types = constants.types;
var relayTypes = constants.relayTypes;

var packetString = require('./helpers/PacketPrinter').packetString;

// This connects an HTTP endpoint and the tor network
// by creating an HTTP stream, packaging data in tor
// data cells, and sending them over

// streamID -> array with stream information
// {status, requests, closecallback}
var streams = {};

// Will always be 0 - this router sees all incoming HTTP requests as
// being to/from a socket 0.
var socketID = 0;

// Increment each time we destroy and remake a circuit
var circuitID = 0;

// The length of a completed circuit
var COMPLETED_CIRCUIT_LENGTH = 3;

// The entry point of the circuit
var circuitEntry;

// The current length of the circuit
var circuitLength = 0;

var extendFailedCounter = 0;

function createFirstHop() {
	circuitID++;
	streams = {};
	circuitEntry = undefined;
	circuitLength = 0;
	var router = getRandomRouter();
	getConnection(router.agent, router.connectInfo, function(status, establisher) {
		// if we did not successfully connect
		if(status === 'failure') {
			// try again
			createFirstHop();
			return;
		} else {
			// Register our handler with the socket, and send a create message
			var create = makeOps.constructCreate(circuitID);
			establisher.registerHandler(circuitID, socketID, function(status, message) {
				responseHandler(status, message, establisher);
			});
			establisher.sendMessage(socketID, create);
		}
	});
}

// Sends an extend message to a random router through our existing partial circuit
function extendCircuit() {
	var router = getRandomRouter();
	var extendBody = makeOps.constructRelayBody(router.connectInfo.ip, router.connectInfo.port, router.agent);
	var extend = makeOps.constructRelayExtend(circuitID, extendBody);
	circuitEntry.sendMessage(socketID, extend);
}

function responseHandler(status, message, establisher) {
	if(status === 'success') {
		var type = readOps.getType(message);
		if(type === types.relay) {
			var relayType = readOps.getRelayCommand(message);
			var streamID = readOps.getStreamID(message);
			if(relayType === relayTypes.data) {
				// received data
			} else if(relayType === relayTypes.connected) {
				// success for stream creation
				// send everything in request queue for this streamID
				streams[streamID].status = 'ready';
				sendQueue();
			} else if(relayType === relayTypes.begin_failed) {
				// failure for stream creation
				delete streams[streamID];
			} else if(relayType === relayTypes.extended) {
				// success for extended
				circuitLength++;
				extendFailedCounter = 0;
				if(circuitLength < COMPLETED_CIRCUIT_LENGTH) {
					extendCircuit();
				} else {
					// circuit is complete
					sendQueue();
				}
			} else if(relayType === relayTypes.extend_failed) {
				// failure for extended
				extendFailedCounter++;
				if(extendFailedCounter > 10) {
					console.log("Ten consecutive failures on extending, restarting circuit");
					createFirstHop();
				}
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
		for(var key in streams) {
			destroyStream(key);
		}
		createFirstHop();
	}
}

function openStream(streamID, host, port, closeCallback) {
	streams[streamID] = {};
	var body = makeOps.constructRelayBody(host, port);
	var streamBegin = makeOps.constructRelayBegin(circuitID, streamID, body);
	streams[streamID].requests.push(streamBegin);
	streams[streamID].status = 'primed';
	streams[streamID].closeCallback = closeCallback;

	sendQueue();
}

function sendMessage(streamID, data) {
	if(streams[streamID] && streams[streamID].status !== 'ending') {
		var dataCell = makeOps.constructRelayData(circuitID, streamID, new Buffer(data));
		streams[streamID].requests.push(dataCell);

		sendQueue();
	}
}

function endStream(streamID) {
	var streamEnd = makeOps.constructRelayEnd(circuitID, streamID);
	streams[streamID].requests.push(streamEnd);
	streams[streamID].status = 'ending';

	sendQueue();
}

function sendQueue() {
	if(circuitLength === COMPLETED_CIRCUIT_LENGTH) {
		console.log("SENDING QUEUE, CIRCUIT COMPLETE");
		for(var key in streams) {
			var requestArray = streams[key].requests;
			// Stream is created
			if(streams[key].status === 'ready' || streams[key].status === 'ending') {
				while(requestArray.length > 0) {
					if(circuitLength !== COMPLETED_CIRCUIT_LENGTH) {
						return;
					}
					var message = requestArray.shift();
					circuitEntry.sendMessage(socketID, message);
				}
				if(streams[key].status === 'ending') {
					destroyStream(key);
				}
			// Stream is not created, and is not waiting for a begin response
			} else if(streams[key].status === 'primed') {
				streams[key].status = 'waiting';
				var beginMessage = requestArray.shift();
				circuitEntry.sendMessage(socketID, beginMessage);
			}
		}
	}
}

function destroyStream(streamID) {
	if(typeof(streams[key].closeCallback) === 'function') {
		streams[key].closeCallback();
	}
	delete streams[streamID];
}

setInitialCallback(createFirstHop);

module.exports = {
	openStream : openStream,
	sendMessage : sendMessage,
	endStream : endStream
};