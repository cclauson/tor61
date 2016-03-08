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
var circuitID = 1;

// The length of a completed circuit
var COMPLETED_CIRCUIT_LENGTH = 3;

// The entry point of the circuit
var circuitEntry;

// The current length of the circuit
var circuitLength = 0;

var extendFailedCounter = 0;

function createFirstHop(isRecreate) {
	if(isRecreate) {
		circuitID++;
		for(var key in streams) {
			streams[key].updateCircuit(circuitID);
		}
	}
	circuitEntry = undefined;
	circuitLength = 0;
	lastRouter = getRandomRouter(invalidList);
	getConnection(lastRouter.agent, lastRouter.connectInfo, function(status, establisher) {
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

var lastRouter;
var invalidList = [];

// Sends an extend message to a random router through our existing partial circuit
function extendCircuit() {
	lastRouter = getRandomRouter();
	var extendBody = makeOps.constructRelayBody(lastRouter.connectInfo.ip, lastRouter.connectInfo.port, lastRouter.agent);
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
				// send to HTTPEndpoint
				var body = readOps.getBodyBuffer(message);
				var stream = streams[streamID];
				if(stream) {
					stream.respond(body);
				}
			} else if(relayType === relayTypes.connected) {
				// success for stream creation
				// send everything in request queue for this streamID
				if(streams[streamID]) {
					streams[streamID].status = 'ready';
					streams[streamID].begin();
					sendQueue();
				}
			} else if(relayType === relayTypes.begin_failed || relayType === relayTypes.end) {
				// Destroy this stream
				var stream = streams[streamID];
				if(stream) {
					stream.close();
				}
				
			} else if(relayType === relayTypes.extended) {
				// success for extended
				circuitLength++;
				extendFailedCounter = 0;
				invalidList = [];
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
					invalidList = [];
					createFirstHop(true);
				}
				invalidList.push(lastRouter);
				extendCircuit();
			}
		} else if(type === types.created) {
			// success for first hop
			circuitEntry = establisher;
			circuitLength = 1;
			invalidList = [];
			extendCircuit();
		} else if(type === types.create_failed) {
			// failure for first hop
			invalidList.push(lastRouter);
			createFirstHop();
		}
	} else if(status === 'ended') {
		for(var key in streams) {
			streams[key].status = 'primed';
		}
		createFirstHop(true);
	}
}

function HTTPStream(streamID, host, port, openCallback) {

	var self = this;

	var callbacks = {};

	var beginMessage;
	var requests = [];
	var responseQueue = [];

	this.status = 'primed';

	this.updateCircuit = function(newID) {
		makeOps.modifyCircuitID(beginMessage, newID);
		for(var i = 0; i < requests.length; i++) {
			makeOps.modifyCircuitID(requests[i], newID);
		}
	};

	this.begin = function() {
		openCallback();
	};

	this.pushRequest = function(request) {
		requests.push(request);
	};

	this.shiftRequest = function() {
		return requests.shift();
	};

	this.getRequestCount = function() {
		return requests.length;
	};

	this.getBeginMessage = function() {
		return beginMessage;
	};

	this.write = function(data, callback) {
		if(self.status !== 'closed' && self.status !== 'ending') {
			var dataCell = makeOps.constructRelayData(circuitID, streamID, new Buffer(data));
			requests.push(dataCell);

			sendQueue();
		}
	};

	this.respond = function(response) {
		responseQueue.push(response);
		sendResponseQueue();
	};

	this.on = function(event, callback) {
		callbacks[event] = callback;
	};

	this.removeListener = function(event) {
		delete callbacks[event];
	};

	this.end = function() {
		if(self.status !== 'ending' && self.status !== 'closed') {
			var streamEnd = makeOps.constructRelayEnd(circuitID, streamID);
			requests.push(streamEnd);
			self.status = 'ending';

			sendQueue();
		}
	};

	this.close = function(callback) {
		if(callbacks.close) {
			callbacks.close();
			delete streams[streamID];
			self.status = 'closed';
		}
	};

	function sendResponseQueue() {
		if(callbacks.data) {
			while(responseQueue.length > 0) {
				if(!callbacks.data) {
					return;
				}
				var data = responseQueue.shift();
				callbacks.data(data);
			}
		}
	}

	var body = makeOps.constructRelayBody(host, port);
	beginMessage = makeOps.constructRelayBegin(circuitID, streamID, body);

	streams[streamID] = this;

	sendQueue();
}

function sendQueue() {
	if(circuitLength === COMPLETED_CIRCUIT_LENGTH) {
		// console.log("SENDING QUEUE, CIRCUIT COMPLETE");
		for(var key in streams) {
			var stream = streams[key];
			// Stream is created
			if(stream.status === 'ready' || stream.status === 'ending') {
				while(stream.getRequestCount() > 0) {
					if(circuitLength !== COMPLETED_CIRCUIT_LENGTH) {
						return;
					}
					var message = stream.shiftRequest();
					circuitEntry.sendMessage(socketID, message);
				}
				if(stream.status === 'ending') {
					stream.close();
				}
			// Stream is not created, and is not waiting for a begin response
			} else if(stream.status === 'primed') {
				stream.status = 'waiting';
				circuitEntry.sendMessage(socketID, stream.getBeginMessage());
			}
		}
	}
}

setInitialCallback(createFirstHop);

module.exports = {
	HTTPStream : HTTPStream
};