import httpfilter

#A class that sits on top of layer zero,
#which provides a view of HTTP/TCP connections,
#which browsers can initiate with us, and which
#we can initiate with HTTP servers.
#Note that this layer will not notify the
#higher layer of an incoming browser connection
#until it knows the server that it is ultimately
#intended for, this means that this layer
#encapsulates code that parses the HTTP header,
#and will also cache the contents until it has
#parsed the header
class HttpLayer:

  def __init__(self):
    #initialize callbacks to none
    self.closeTcpCallback = None
    self.sendTcpDataCallback = None
    self.createTcpConCallback = None
    self.newBrowserCallback = None
    self.dataArrivedCallback = None
    self.connectionLostCallback = None

    #also a hashmap, hash a TCP connection to
    #the current state of the connection.
    #state is a (filter, string, int) triple,
    #the filter is an http filter that all http info will
    #pass through, the string is data that
    #has already gone through the filter, but
    #we have not yet delivered to the higher
    #level, and the int is 0 if a client connection,
    #otherwise 1 for server (TODO: Use sym constants?)
    #A general principle with filtering on a
    #connection--we filter data that *arrives*,
    #not data that is being *sent*
    self.connectionMap = {}

  ####### BEGIN PRIVATE LAYER 0 OUTPUT EVENT METHODS ########

  def __closeTcpConnection(self, socket):
    self.closeTcpCallback(socket)

  def __sendDataOnTcpConnection(self, socket, data):
    self.sendTcpDataCallback(socket, data)

  def __createTcpConnection(self, host, portnum, callback):
    self.createTcpConCallback(host, portnum, callback)

  ######### END PRIVATE LAYER 0 OUTPUT EVENT METHODS #########


  ####### BEGIN PRIVATE UPPER LAYER OUTPUT EVENT METHODS ########

  def __newBrowserConnection(self, connection, destHost, destPort):
    self.newBrowserCallback(connection, destHost, destPort)

  def __dataArrivedOnConnection(self, connection, data):
    self.dataArrivedCallback(connection, data)

  def __httpTcpConnectionLost(self, connection):
    self.connectionLostCallback(connection)

  ######### END PRIVATE UPPER LAYER OUTPUT EVENT METHODS #########


  ######### BEGIN LAYER 0 INPUT EVENT METHODS ##############

  def newHttpTcpConnection(self, socket):
    #print "Got connection from browser..."
    #Just create new table entry, we can't deliver to the upper
    #layer until we know the host/portnum
    self.connectionMap[socket] = (httpfilter.HttpFilter(), '', 0)

  def tcpConnectionLost(self, socket):
    #it might not be an http socket
    if not socket in self.connectionMap.keys():
      return
    #print "http layer received connection lost event"
    #first clean up, but get map contents first
    filt, buff, server = self.connectionMap[socket]
    del self.connectionMap[socket]
    #we only want to deliver the event to the next layer
    #up if it knows about the connection, i.e., unless
    #it's a browser connection that we haven't seen
    #the header for
    if (server == 1) or (filt.headerDone):
      self.__httpTcpConnectionLost(socket)

  def dataArrivedOnTcpConnection(self, socket, data):
    #print "Getting data: {}".format(data)
    #it might not be an http socket
    if not socket in self.connectionMap.keys():
      return
    filt, buff, server = self.connectionMap[socket]
    #in any case, pass data through filter, but cache
    #whether or not header was done
    wasHeaderDone = filt.headerDone
    data = filt.processMoreData(data)
    if server == 1: #it's a server connection
      #for a server connection, the upper layer already knows
      #about the connection, so actually the 'buff' string
      #should be empty and always will be, we just pass data
      #through filter and deliver immediately to higher layer
      if buff != '':
        raise RuntimeError("buffer for server connection unexpectedly not empty")
      self.__dataArrivedOnConnection(socket, data)
    else: #it's a client/browser connection
      #in this case, the upper layer may or may not have been
      #notified yet.
      if wasHeaderDone and filt.headerDone:
        #this is an older connection that upper layer knows
        #about, deliver data directly, buffer should actually
        #be empty
        if buff != '':
          raise RuntimeError("buffer for older browser connection unexpectedly not empty")
        self.__dataArrivedOnConnection(socket, data)
      elif not wasHeaderDone and filt.headerDone:
        #case where we just saw the last of the header,
        #we need to notify upper layer, first check that
        #we parsed the host correctly
        #print "Received header"
        desthost, destportnum = filt.getHostPortnum()
        if desthost == None:
          #we couldn't get the host from the http request,
          #so let's close the tcp connection, we don't notify
          #upper layer of anything
          self.__closeTcpConnection(socket)
          del self.connectionMap[socket]
        else:
          #notify upper layer, also send all buffered data
          self.__newBrowserConnection(socket, desthost, destportnum)
          self.__dataArrivedOnConnection(socket, buff + data)
          buff = ''
          self.connectionMap[socket] = (filt, buff, server)
      elif not wasHeaderDone and not filt.headerDone:
        #we don't know what the host/portnum is, so we just buffer
        #print "Buffering in httplayer"
        buff = buff + data
        self.connectionMap[socket] = (filt, buff, server)        
      else:
        #this would mean that we used to know the header, but
        #now don't, this should never happen
        raise RuntimeError('header went from read to unread, this should not happen')

  ######### END LAYER 0 INPUT EVENT METHODS ##############

  ######### BEGIN UPPER LAYER INPUT EVENT METHODS ##############

  def createHttpTcpConnectionToServer(self, host, portnum, callback):
    #we need to call the lower layer tcp create function,
    #so define a callback
    def handleResult(tcpConnectionResult):
      #the order matters here, we need to update our own
      #state before delivering the higher level event
      if tcpConnectionResult != None:
        #lower layer TCP creation succeeded, so we
        #update hashmap
        self.connectionMap[tcpConnectionResult] = (httpfilter.HttpFilter(), '', 1)
      #in either case, we call back the upper layer
      #to indicate success/failure
      callback(tcpConnectionResult)
    #using this callback, send message to lower layer
    self.__createTcpConnection(host, portnum, handleResult)

  def sendHttpDataOnConnection(self, connection, data):
    #first verify that it's a valid connection
    if not connection in self.connectionMap.keys():
      #note that we can do things like this because we're enforcing
      #non-reentrancy on layer 0, otherwise not only would this be
      #invalid but everything else would be a nightmare as well
      raise ValueError('Got data send request on invalid connection')
    #we don't filter on the way out, so just route to
    #lower layer
    self.__sendDataOnTcpConnection(connection, data)

  def closeHttpTcpConnection(self, connection):
    #first verify that it's a valid connection
    if not connection in self.connectionMap.keys():
      #note that we can do things like this because we're enforcing
      #non-reentrancy on layer 0, otherwise not only would this be
      #invalid but everything else would be a nightmare as well
      raise ValueError('Got connection close request on invalid connection')
    self.__closeTcpConnection(connection)
    del self.connectionMap[connection]

  ######### END UPPER LAYER INPUT EVENT METHODS ##############




