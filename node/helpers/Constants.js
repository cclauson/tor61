var types = {
	create : 0x01,
	created : 0x02,
	relay : 0x03,
	destroy : 0x04,
	open : 0x05,
	opened : 0x06,
	open_failed : 0x07,
	create_failed : 0x08,
};

var relayTypes = {
	begin : 0x01,
	data : 0x02,
	end : 0x03,
	connected : 0x04,
	extend : 0x06,
	extended : 0x07,
	begin_failed : 0x0b,
	extend_failed : 0x0c
};

global.MY_GROUP = 0x0455;
global.MY_AGENT;

// The chances we'll ever have a high enough ID for this
// to be a problem are astronomically low, but hey, may as
// well be safe.
global.MAX_ID = Math.pow(2, 53) - 5;

module.exports = {
	types : types,
	relayTypes : relayTypes
};