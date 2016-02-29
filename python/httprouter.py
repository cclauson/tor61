
#Layer gets incoming http connections,
#creates outgoing ones in response,
#and routes data between them.
#Currently sits on top of the Http layer,
#but if there was a Tor layer then that
#would connect here as well, using the
#tor stream interface.
class HttpRouter:

  def __init__(self):
    self.createServerConnCallback = None
    self.sendDataCallback = None
    self.closeConnectionCallback = None

    #All connections should eventually be
    #paired, and data routed between them,
    #so we use a table.  Each pair (a, b)
    #has two entries, a -> b and b -> a,
    #we should be careful to create these
    #together and clean them both up at
    #the end 
    self.routingTable = {}
    #we create a set for unpaired connections,
    #these will only exist for a very short
    #time while we are waiting for a new server
    #connection result, but we need to keep
    #track of them
    #CHANGE: Actually make it a hashmap, the
    #key will be a string representing buffered
    #data
    self.unpairedConnections = {}

  ####### BEGIN PRIVATE HTTP LAYER OUTPUT EVENT METHODS ########

  def __createHttpTcpConnectionToServer(self, host, portnum, callback):
    self.createServerConnCallback(host, portnum, callback)  

  def __sendHttpDataOnConnection(self, connection, data):
    self.sendDataCallback(connection, data)

  def __closeHttpTcpConnection(self, connection):
    self.closeConnectionCallback(connection)

  ######### END PRIVATE HTTP LAYER OUTPUT EVENT METHODS #########

  ####### BEGIN HTTP LAYER INPUT EVENT METHODS ########

  def newBrowserConnection(self, connection, destHost, destPort):
    #sanity check that connection isn't already in our table
    if connection in self.routingTable.keys() or connection in self.unpairedConnections.keys():
      raise ValueError('new browser connection unexpectedly already exists in table!')
    #cache this in the unpaired connections set with empty buffer
    self.unpairedConnections[connection] = ''
    #we need to create a new server connection that pairs
    #with the browser connection, so define a callback
    def handleResult(connResult):
      if connection in self.unpairedConnections.keys():
        if connResult == None:
          #we failed to connect to the server, so close
          #the browser connection, we are rejecting it
          self.__closeHttpTcpConnection(connection)
        else:
          #first sanity check that we haven't seen this
          #connection before
          if connResult in self.routingTable.keys():
            raise ValueError('new server connection unexpectedly already exists in table!')
          #so we create routing table entries indicating that these
          #connections are paired
          if connResult == connection:
            raise RuntimeError("two connections routed together, but this should never happen")
          self.routingTable[connection] = connResult
          self.routingTable[connResult] = connection
          #also send any buffered data immediately
          self.__sendHttpDataOnConnection(connResult, self.unpairedConnections[connection])
        #in any case, connection is not unpaired anymore and data has either
        #been sent or doesn't matter
        del self.unpairedConnections[connection]
      else:
        #actually the original connection no longer exists,
        #we don't want this connection anymore
        if connResult == None:
          #both connections are gone, we don't need to do anything
          pass
        else:
          #just shut down the new connection
          self.__closeHttpTcpConnection(connResult)
    #now that callback is defined, request the creation
    #of a connection to the server with the above callback
    #to handle the result
    self.__createHttpTcpConnectionToServer(destHost, destPort, handleResult)

  def dataArrivedOnConnection(self, connection, data):
    if connection in self.routingTable.keys():
      #there's already a route, so we send the data across
      destConn = self.routingTable[connection]
      self.__sendHttpDataOnConnection(destConn, data)
    elif connection in self.unpairedConnections.keys():
      #we don't have a route yet, so buffer the data
      self.unpairedConnections[connection] = self.unpairedConnections[connection] + data
    else:
      #this shouldn't happen
      raise ValueError('got notification of data arrival, but do not recognize connection')

  def httpTcpConnectionLost(self, connection):
    if connection in self.routingTable.keys():
      #close corresponding connection, and remove table entries
      otherConn = self.routingTable[connection]
      #sanity check that the connections aren't the same
      if connection == otherConn:
        raise RuntimeError('unexpectedly found connection routed to itself')
      self.__closeHttpTcpConnection(otherConn)
      del self.routingTable[connection]
      del self.routingTable[otherConn]
    elif connection in self.unpairedConnections.keys():
      #we just remove the connection from the unpairedConnections()
      #table
      del self.unpairedConnections[connection]
    else:
      #this shouldn't happen
      raise ValueError('got notification of connection loss, but do not recognize connection')



  ######### END HTTP LAYER INPUT EVENT METHODS #########


