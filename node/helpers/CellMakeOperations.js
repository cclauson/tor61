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

function constructRelayBegin() {

}

function constructRelayData() {
	
}

function constructRelayEnd() {
	
}

function constructRelayConnected() {
	
}

function constructRelayExtend() {
	
}

function constructRelayExtended() {
	
}

function constructRelayBeginFailed() {
	
}

function constructRelayExtendFailed() {
	
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

function constructRelayHelper() {

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