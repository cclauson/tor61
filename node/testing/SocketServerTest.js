var net = require('net');
var readline = require('readline');
var makeOps = require('../helpers/CellMakeOperations');

var serverPort = 4444;

var sock;

var server = net.createServer(function(socket) {
	console.log("CONNECTED");
	sock = socket;
});

server.on('error', function(err) {
	console.log(err);
});

server.listen(serverPort, function(err) {
	if(err) throw err;
	address = server.address();
	console.log("Proxy listening on " + address.address + ":" + address.port);
});

var rl = readline.createInterface(process.stdin, process.stdout);

// rl.on('line', function(data) {
// 	var extendedData = "";
// 	var end = parseInt(Math.random() * 50) + 100;
// 	for(var i = 0; i < end; i++) {
// 		extendedData = extendedData + data;
// 	}
// 	sock.write(extendedData);
// });

// rl.on('line', function(data) {
// 	if(data == 'potato') {
// 		var extendData = "";
// 		// for(var i = 0; i < len; i++) {
// 		// 	extendData = extendData + 'a';
// 		// }
// 		for(var i = 0; i < 1020; i++) {
// 			extendData = extendData + 'a';
// 		}
// 		var tester = new Buffer(extendData);
// 		tester[2] = 3;
// 		tester[11] = 2;
// 		tester[12] = 1;
// 		sock.write(tester);
// 	} else {
// 		var len = parseInt(data);
// 		var extendData = "";
// 		for(var i = 0; i < len; i++) {
// 			extendData = extendData + 'a';
// 		}
// 		sock.write(extendData);
// 	}
// });

rl.on('line', function(cmd) {
	cmd = cmd.split(' ');
	var message;
	if(cmd[0] === 'open') {
		message = makeOps.constructOpen(0xAABBCCDD, 0x11223344);
	} else if(cmd[0] === 'opened') {
		message = makeOps.constructOpened(0x11223344, 0xAABBCCDD);
	} else if(cmd[0] === 'fail') {
		message = makeOps.constructOpenFailed(0x11223344, 0xAABBCCDD);
	} else if(cmd[0] === 'created') {
		message = makeOps.constructCreated(parseInt(cmd[1]));
	} else if(cmd[0] === 'create_failed') {
		message = makeOps.constructCreateFailed(parseInt(cmd[1]));
	} else if(cmd[0] === 'destroy') {
		message = makeOps.constructDestroy(parseInt(cmd[1]));
	} else if(cmd[0] === 'gibberish') {
		message = makeOps.constructCreate(123);
	} else {
		console.log("COMMAND INVALID: " + cmd[0]);
	}
	sock.write(message);
})