// This connects an HTTP endpoint and the tor network
// by creating an HTTP stream, packaging data in tor
// data cells, and sending them over

// Potentially also creates a circuit if the current one
// is down.