var glob = require("./helpers/Constants").glob;

glob.TOR_PORT = parseInt(process.argv[2]);
glob.MY_INSTANCE = parseInt(process.argv[3]);
glob.MY_AGENT = (glob.MY_GROUP << 16) + glob.MY_INSTANCE;

require("./RouterManager");
require("./ConnectionManager");