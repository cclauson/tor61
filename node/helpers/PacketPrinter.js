var readOps = require('./CellReadOperations');
var constants = require('./Constants');

var types = constants.types;
var relayTypes = constants.relayTypes;

var reverseTypes = {};
for(var type in types) {
	reverseTypes[types[type]] = type;
}

var reverseRelayTypes = {};
for(var relayType in relayTypes) {
	reverseRelayTypes[relayTypes[relayType]] = relayType;
}

function packetString(cell) {

	var cellString = "";

	// Get circuit ID
	var type = readOps.getType(cell);
	if(type === types.open || type === types.opened || type === types.open_failed) {
		cellString += "No Circuit ID"
	} else {
		var circuitID = readOps.getCircuit(cell);
		cellString += "Circuit ID: 0x" + circuitID.toString(16);
	}
	cellString += "\n";

	cellString += "Type: 0x" + type.toString(16) + " (" + reverseTypes[type] + ")";

	cellString += "\n";

	if(type === types.open || type === types.opened || type === types.open_failed) {
		var openerID = readOps.getOpenerAgent(cell);
		var openedID = readOps.getOpenedAgent(cell);
		cellString += "Opener Agent: 0x" + openerID.toString(16) + "\n";
		cellString += "Opened Agent: 0x" + openedID.toString(16) + "\n";
	} else if(type === types.relay) {
		var streamID = readOps.getStreamID(cell);
		var padding = readOps.getPadding(cell);
		var bodyLength = readOps.getBodyLength(cell);
		var relayCommand = readOps.getRelayCommand(cell);
		var body = readOps.getBodyString(cell);

		cellString += "Stream ID: 0x" + streamID.toString(16) + "\n";
		cellString += "Padding: 0x" + padding.toString(16) + "\n";
		cellString += "Body Length: 0x" + bodyLength.toString(16) + "\n";
		cellString += "Relay Command: 0x" + relayCommand.toString(16) + " (" + reverseRelayTypes[relayCommand] + ")\n";
		cellString += "Body: " + body + "\n";
	}

	return cellString;
}

module.exports = {
	packetString : packetString
};