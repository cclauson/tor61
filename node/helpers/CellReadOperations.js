function getType(cell) {
	return getData(cell, 2, 3);
}

function getCircuit(cell) {
	return getData(cell, 0, 2);
}

function getOpenerAgent(cell) {
	return getData(cell, 3, 7);
}

function getOpenedAgent(cell) {
	return getData(cell, 7, 11);
}

function getStreamId(cell) {
	return getData(cell, 3, 5);
}

function getPadding(cell) {
	return getData(cell, 5, 7);
}

function getBodyLength(cell) {
	return getData(cell, 11, 13);
}

function getRelayCommand(cell) {
	return getData(cell, 13, 14);
}

function getBody(cell) {
	var length = getBodyLength(cell);
	return getData(cell, 14, 14 + length);
}

function getData(cell, startByte, endByte) {
	var data = 0;
	for(var i = startByte; i < endByte; i++) {
		data *= 256;
		data += cell[i];
	}
	return data;
}

module.exports = {
	getType : getType,
	getCircuit : getCircuit,
	getOpenerAgent : getOpenerAgent,
	getOpenedAgent : getOpenedAgent,
	getStreamId : getStreamId,
	getPadding : getPadding,
	getBodyLength : getBodyLength,
	getRelayCommand : getRelayCommand,
	getBody : getBody
};