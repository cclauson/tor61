var glob = require("./helpers/Constants").glob;

glob.SERVER_PORT = parseInt(process.argv[2]);
glob.TOR_PORT = parseInt(process.argv[3]);
glob.MY_INSTANCE = parseInt(process.argv[4]);
glob.MY_AGENT = (glob.MY_GROUP << 16) + glob.MY_INSTANCE;

require("./RouterManager");
require("./ConnectionManager");
var creator = require("./CircuitCreator");
require("./proxy/proxy");

// creator.openStream(1, 'google.com', 80, function(data) {
// 	console.log("RECEIVED RESPONSE");
// }, function() {
// 	console.log("Connection ended");
// });

// var tester = new creator.HTTPStream(1, 'gookljaklsjdfklgle.com', 80, function() {

// });

// tester.on('data', function(data) {
// 	console.log("RECEIVED RESPONSE");
// });

// tester.on('close', function() {
// 	console.log("CLOSED");
// });

// var readline = require('readline');
// var rl = readline.createInterface(process.stdin, process.stdout);
// rl.on('line', function(cmd) {
// 	if(cmd === 'end') {
// 		tester.end();
// 	} else {
// 		tester.write(cmd);
// 	}
// });