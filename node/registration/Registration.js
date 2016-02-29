const spawn = require('child_process').spawn;
const regService = spawn('python', ['./registration/register.py', 'cse461.cs.washington.edu', '46101']);

var listener = false;

function setListener(newListener) {
	removeListener();
	listener = function(data) {
		data = trimNewlines(data);
		var splitData = data.toString().split("\n");
		for(var i = 0; i < splitData.length; i++) {
			if(splitData[i][0] === '>') {
				console.log(splitData[i])
			} else if(splitData[i][0] !== '<') {
				newListener(splitData[i]);
			}
		}
	};
	regService.stdout.on('data', listener);
}

function removeListener() {
	if(listener) {
		regService.stdout.removeListener('data', listener);
		listener = false;
	}
}

function trimNewlines(data) {
	while(data[data.length - 1] === 10) {
		data = data.slice(0, data.length - 1);
	}
	return data;
}

regService.stderr.on('data', function(data) {
	console.log("ERROR IN REG SERVICE: " + data.toString());
});

regService.on('close', function() {
	console.log("ENDED");
});

function sendMessage() {
	var sendString = ""
	for(var i = 0; i < arguments.length - 1; i++) {
		sendString += arguments[i] + " ";
	}
	sendString += arguments[arguments.length - 1] + "\n";
	regService.stdin.write(sendString);
}

function register(portnum, agentID, name, callback) {
	setListener(function(data) {
		if(data === 'register_success') {
			callback(true);
		} else {
			callback(data);
		}
	});
	sendMessage("r", portnum, agentID, name);
}

function unregister(portnum, callback) {
	setListener(function(data) {
		if(data === 'unregister_success') {
			callback(true);
		} else {
			callback(false);
		}
	});
	sendMessage("u", portnum);
}

function fetch(prefix, callback) {
	var entries = [];
	setListener(function(data) {
		if(data === 'fetch_end') {
			callback(entries);
		} else {
			var dataSplit = data.split("\t");
			if(dataSplit[0] === "fetch_entry") {
				entries.push({
					connectInfo : {
						ip : dataSplit[1],
						port : parseInt(dataSplit[2])
					},
					agent : parseInt(dataSplit[3])
				});
			} else {
				callback(false);
			}
		}
	});

	if(prefix) {
		sendMessage('f', prefix);
	} else {
		sendMessage('f');
	}
}

module.exports = {
	register : register,
	unregister : unregister,
	fetch : fetch
};