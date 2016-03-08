var glob = require("./helpers/Constants").glob;

glob.SERVER_PORT = parseInt(process.argv[2]);
glob.TOR_PORT = parseInt(process.argv[3]);
glob.MY_GROUP = parseInt(process.argv[4], 16);
glob.MY_INSTANCE = parseInt(process.argv[5], 16);
glob.LOGGING = process.argv[6];
glob.MY_AGENT = (glob.MY_GROUP << 16) + glob.MY_INSTANCE;

require("./RouterManager");
require("./ConnectionManager");
require("./CircuitCreator");
require("./proxy/proxy");
