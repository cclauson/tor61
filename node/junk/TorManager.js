var manager = require('./TorConnectionManager');
var makeOps = require('./helpers/CellMakeOperations');
var checkOps = require('./helpers/CellCheckOperations');

var circuitID = 1;
var socketID = 2;

var length = 0;

function createCircuit() {
	var firstRouter = manager.getRandomRouter();
	manager.getConnection(firstRouter.agent, firstRouter.connectInfo, function(status, establisher) {
		var create = makeOps.constructCreate(circuitID);

		establisher.registerHandler(circuitID, socketID, function(status, message) {
			if(checkOps.validateCreated(message, circuitID) || checkOps.validateRelayExtended(message, circuitID, 0)) {
				var nextRouter = manager.getRandomRouter();
				var agentBuffer = new Buffer(4);
				for(var i = 0; i < agentBuffer.length; i++) {
					agentBuffer[i] = (nextRouter.agent >> (8 * agentBuffer.length - i - 1)) & 0xFF;
				}
				var body = nextRouter.connectInfo.ip + ":" + nextRouter.connectInfo.port + "\0" + agentBuffer.toString();
				var extend = makeOps.constructRelayExtend(circuitID, 0, body);
				establisher.sendMessage(socketID, extend);
				length++;

				if(length === 3) {
					console.log("CIRCUIT MADE");
					establisher.registerHandler(circuitID, socketID, function() {});
				}
			}
		});

		establisher.sendMessage(socketID, create);
	});
}

manager.registerOnReady(function() {
	createCircuit();
});

function sendData(circuit, data) {

}

module.exports = {
	createCircuit : createCircuit,
	sendData : sendData
};