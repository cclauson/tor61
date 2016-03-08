var glob = require("../helpers/Constants").glob;
var net = require('net');
var circuit = require('../CircuitCreator');

var httpSockets = {};

// --------------------------------------
// 	Set up server to listen for connections
// --------------------------------------

var serverPort = glob.SERVER_PORT;

var server = net.createServer(function(socket) {
	new RequestHandler(socket);
});

server.on('error', function(err) {
	console.log(err);
});

server.listen(serverPort, function(err) {
	if(err) throw err;
	address = server.address();
	console.log("Proxy listening on " + address.address + ":" + address.port);
});

function connectToServer() {

}

function closeConnection() {

}

function sendData() {

}