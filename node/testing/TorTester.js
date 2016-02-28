var net = require('net');

var TorSocket = require('../TorSocket').TorSocket;
var TorConnector = require('../TorConnector').TorConnector;
var makeOps = require('../helpers/CellMakeOperations');

var serverInfo = {
	host: 'localhost',
	port: 4444
};

var testSocket = net.createConnection(serverInfo, function() {
	var torSocket = new TorSocket(testSocket, 1);
	var torConnector = new TorConnector(torSocket, 0xAABBCCDD, function(status, sendMessage) {
		console.log("HANDSHAKE CALLED: " + status);
		sendMessage(makeOps.constructCreate(0x1234), 0x5678, function(status, message) {
			console.log("MESSAGE CALLBACK CALLED");
			console.log(status);
			console.log(message);
		});

		sendMessage(makeOps.constructCreate(0x4321), 0x5678, function(status, message) {
			console.log("MESSAGE CALLBACK CALLED");
			console.log(status);
			console.log(message);
		});
	});
});