// Handles converting raw TCP messages from the browser
// into Tor data packets with a stream ID.

// Though this class manages stream IDs, it doesn't handle
// sending begin commands or anything of that nature. That
// is all handled transparently by CircuitCreator