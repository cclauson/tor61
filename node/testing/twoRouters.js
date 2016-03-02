var net = require('net');
var stdin = require('process').stdin;

var readOps = require('../helpers/CellReadOperations');
var makeOps = require('../helpers/CellMakeOperations');
var packetString = require('../helpers/PacketPrinter').packetString;

var torAgent = 0x45504D2;

var agent1 = 1;
var agent2 = 2;

var torInfo = {
	host : 'localhost',
	port : 4567
};

var sock = net.createConnection(torInfo, function() {
	console.log("Connected TCP socket to router");
	var open = makeOps.constructOpen(agent1, torAgent);
	sock.on('data', respondToOpened);
	setNextEnter(function() {
		sock.write(open);
		console.log("Sent open to router");
		console.log(packetString(open));
		console.log();
	});
});

var respondToOpened = function(data) {
	console.log("Received Opened from router");
	console.log(packetString(data));
	console.log();
	sock.removeListener('data', respondToOpened);
	sock.on('data', respondToCreated);
	var create = makeOps.constructCreate(1);
	setNextEnter(function() {
		sock.write(create);
		console.log("Sent create to router");
		console.log(packetString(create));
		console.log();
	});
};

var respondToCreated = function(data) {
	console.log("Received Created from router");
	console.log(packetString(data));
	console.log();
	sock.removeListener('data', respondToCreated);
	sock.on('data', respondToExtended);
	var body = makeOps.constructRelayBody('localhost', 7654, 0x045510E1);
	// var agentBuffer = new Buffer(4);
	// agentBuffer[0] = 0x04;
	// agentBuffer[1] = 0x55;
	// agentBuffer[2] = 0x10;
	// agentBuffer[3] = 0xE1;
	// var tempBuf = new Buffer('localhost:' + 7654);
	// var body = Buffer.concat([tempBuf, agentBuffer], tempBuf.length + agentBuffer.length);
	var extend = makeOps.constructRelayExtend(1, body);
	setNextEnter(function() {
		sock.write(extend);
		console.log("Wrote extend to other router");
		console.log(packetString(extend));
		console.log();
	});
}

var respondToExtended = function(data) {
	console.log("Received Extended from router");
	console.log(packetString(data));
	console.log();
	sock.removeListener('data', respondToExtended);
	sock.on('data', function(data) {
		console.log("\nReceived on socket 1:");
		console.log(packetString(data));
	});
	var body = makeOps.constructRelayBody('localhost', 4567, 0x045504D2);
	// var agentBuffer = new Buffer(4);
	// agentBuffer[0] = 0x04;
	// agentBuffer[1] = 0x55;
	// agentBuffer[2] = 0x04;
	// agentBuffer[3] = 0xD2;
	// var tempBuf = new Buffer('localhost:' + 4567);
	// var body = Buffer.concat([tempBuf, agentBuffer], tempBuf.length + agentBuffer.length);
	var extend = makeOps.constructRelayExtend(1, body);
	setNextEnter(function() {
		sock.write(extend);
		console.log("Wrote extend back to this router");
		console.log(packetString(extend));
		console.log();
	});
}

var lastFunc;
function setNextEnter(func) {
	lastFunc = function() {
		func();
		stdin.removeListener('data', lastFunc);
	}
	stdin.on('data', lastFunc);
}