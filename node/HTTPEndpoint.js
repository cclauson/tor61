var net = require('net');

// This is where relay calls where we're the endpoint are handled
// For example, an HTTP begin that requires us to open an HTTP socket
// or HTTP Data that needs to go to an open stream

// setInterval(function() {
// 	console.log("Endpoint Sockets: " + Object.keys(streams).length);
// }, 5000);

// socketID, streamID -> HTTP socket
var streams = {};

function beginStream(socketID, circuitID, streamID, ip, port, respond) {
	var key = generateKey(socketID, circuitID, streamID);

	if(isNaN(port) || port < 0 || port > 65535) {
		respond('failed');
		return;
	}

	var socket = net.createConnection({host : ip, port : port}, function() {
		
		socket.on('error', endFailure);
		socket.on('close', endFailure);

		socket.removeListener('close', beginFailure);
		socket.removeListener('error', beginFailure);

		socket.on('data', forwardData);

		streams[key] = socket;

		respond('connected');

	});

	//console.log("BEGINNING STREAM");

	var beginFailure = function() {
		socket.end();
		// socket.removeListener('close', endFailure);
		// socket.removeListener('error', endFailure);
		respond('failed');
		delete streams[key];
	};

	var endFailure = function() {
		socket.end();
		// socket.removeListener('close', endFailure);
		// socket.removeListener('error', endFailure);
		respond('end');
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
		// socket.removeAllListeners('close');
		// socket.removeAllListeners('error');
		socket.end();
		delete streams[key];
	}
}

function receiveData(socketID, circuitID, streamID, data) {
	var key = generateKey(socketID, circuitID, streamID);
	var socket = streams[key];
	if(socket) {
		socket.write(data);
	}
}

// This only allows for socket IDs to go up to
// 2^16. If we get to that point, I imagine we will
// have bigger problems.
function generateKey(socketID, circuitID, streamID) {
	return (socketID << 32) + (circuitID << 16) + streamID;
}

function close() {
	for(var key in streams) {
		socket.end();
	}
}

module.exports = {
	beginStream : beginStream,
	endStream : endStream,
	receiveData : receiveData,
	close : close
};