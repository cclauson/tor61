var constants = require('./Constants');
var types = constants.types;
var relayTypes = constants.relayTypes;

function modifyCircuitID(cell, newCircuit) {
	setData(cell, 0, 2, newCircuit);
	return cell;
}

function constructOpen(openerAgent, openedAgent) {
	return constructOpenHelper(openerAgent, openedAgent, types.open);
}

function constructOpened(openerAgent, openedAgent) {
	return constructOpenHelper(openerAgent, openedAgent, types.opened);
}

function constructOpenFailed(openerAgent, openedAgent) {
	return constructOpenHelper(openerAgent, openedAgent, types.open_failed);
}

function constructCreate(circuitID) {
	return constructCreateHelper(circuitID, types.create);
}

function constructCreated(circuitID) {
	return constructCreateHelper(circuitID, types.created);
}

function constructCreateFailed(circuitID) {
	return constructCreateHelper(circuitID, types.create_failed);
}

function constructDestroy(circuitID) {
	return constructCreateHelper(circuitID, types.destroy);
}

function constructRelayBegin(circuitID, streamID, body) {
	return constructRelayHelper(circuitID, streamID, relayTypes.begin, body);
}

function constructRelayData(circuitID, streamID, body) {
	return constructRelayHelper(circuitID, streamID, relayTypes.data, body);
}

function constructRelayEnd(circuitID, streamID) {
	return constructRelayHelper(circuitID, streamID, relayTypes.end);
}

function constructRelayConnected(circuitID, streamID) {
	return constructRelayHelper(circuitID, streamID, relayTypes.connected);
}

function constructRelayExtend(circuitID, streamID, body) {
	return constructRelayHelper(circuitID, streamID, relayTypes.extend, body);
}

function constructRelayExtended(circuitID, streamID) {
	return constructRelayHelper(circuitID, streamID, relayTypes.extended);
}

function constructRelayBeginFailed(circuitID, streamID) {
	return constructRelayHelper(circuitID, streamID, relayTypes.begin_failed);
}

function constructRelayExtendFailed(circuitID, streamID) {
	return constructRelayHelper(circuitID, streamID, relayTypes.extend_failed);
}

function constructOpenHelper(openerAgent, openedAgent, type) {
	var cell = constructCell(512);
	setData(cell, 2, 3, type);
	setData(cell, 3, 7, openerAgent);
	setData(cell, 7, 11, openedAgent);
	return cell;
}

function constructCreateHelper(circuitID, type) {
	var cell = constructCell(512);
	setData(cell, 0, 2, circuitID);
	setData(cell, 2, 3, type);
	return cell;
}

function constructRelayHelper(circuitID, streamID, relay, body) {
	body = body || "";
	var packet = constructCell(14);
	setData(packet, 0, 2, circuitID);
	setData(packet, 2, 3, types.relay);
	setData(packet, 3, 5, streamID);
	setData(packet, 11, 13, body.length);
	setData(packet, 13, 14, relay);
	if(body.length > 0) {
		var bodyBuffer = new Buffer(body);
		packet = Buffer.concat([packet, bodyBuffer], packet.length + bodyBuffer.length);
	}
	var padding = constructCell(512 - (packet.length % 512));
	packet = Buffer.concat([packet, padding], packet.length + padding.length);
	return packet;
}

function setData(cell, startByte, endByte, val) {
	var counter = 0;
	for(var i = endByte - 1; i >= startByte; i--, counter++) {
		cell[i] = (val >> (8 * counter)) & 0xFF;
	}
}

function constructCell(size) {
	var cell = new Buffer(size);
	cell.fill(0);
	return cell;
}

module.exports = {
	modifyCircuitID : modifyCircuitID,
	constructOpen : constructOpen,
	constructOpened : constructOpened,
	constructOpenFailed : constructOpenFailed,
	constructCreate : constructCreate,
	constructCreated : constructCreated,
	constructCreateFailed : constructCreateFailed,
	constructDestroy : constructDestroy,
	constructRelayBegin : constructRelayBegin,
	constructRelayData : constructRelayData,
	constructRelayEnd : constructRelayEnd,
	constructRelayConnected : constructRelayConnected,
	constructRelayExtend : constructRelayExtend,
	constructRelayExtended : constructRelayExtended,
	constructRelayBeginFailed : constructRelayBeginFailed,
	constructRelayExtendFailed : constructRelayExtendFailed
};