var net = require('net');

// This is where relay calls where we're the endpoint are handled
// For example, an HTTP begin that requires us to open an HTTP socket
// or HTTP Data that needs to go to an open stream

// socketID, streamID -> HTTP socket
var streams = {};

function beginStream(socketID, circuitID, streamID, ip, port, respond) {
	var key = generateKey(socketID, circuitID, streamID);
	var socket = net.createConnection({host : ip, port : port}, function() {
		
		socket.removeAllListeners('close');
		socket.removeAllListeners('error');

		socket.on('error', endFailure);
		socket.on('close', endFailure);

		socket.on('data', forwardData);

		streams[key] = socket;

		respond('connected');

	});

	console.log("BEGINNING STREAM");

	var beginFailure = function() {
		socket.removeAllListeners('close');
		socket.removeAllListeners('error');
		respond('failed');
		socket.end();
		delete streams[key];
	};

	var endFailure = function() {
		socket.removeAllListeners('close');
		socket.removeAllListeners('error');
		respond('end');
		socket.end();
		delete streams[key];
	};

	var forwardData = function(data) {
		respond('data', data);
	};

	socket.on('error', beginFailure);
	socket.on('close', beginFailure);
}

function endStream(socketID, circuitID, streamID) {
	var key = generateKey(socketID, circuitID, streamID);
	var socket = streams[key];
	if(socket) {
		socket.removeAllListeners('close');
		socket.removeAllListeners('error');
		socket.end();
		delete streams[key];
	}
}

function receiveData(socketID, circuitID, streamID, data) {
	var key = generateKey(socketID, circuitID, streamID);
	var socket = streams[key];
	if(socket) {
		console.log("Writing data");
		socket.write(data);
	}
}

// This only allows for socket IDs to go up to
// 2^16. If we get to that point, I imagine we will
// have bigger problems.
function generateKey(socketID, circuitID, streamID) {
	return (socketID << 32) + (circuitID << 16) + streamID;
}

module.exports = {
	beginStream : beginStream,
	endStream : endStream,
	receiveData : receiveData
};