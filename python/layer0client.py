import httprouter, httplayer

#A layer 0 client is an object
#that relies on layer 0 for
#services.
#This code file should really just
#integrate existing modules together,
#describing how they interact with
#layer 0
class Layer0Client:

  def __init__(self):
    #callbacks need to be registered here
    #by code that instantiates this class
    self.closeTcpCallback = None
    self.sendTcpDataCallback = None
    self.createTcpConCallback = None
    self.scheduleTimeoutHandler = None

    #instatiate router and layer
    self.httprouter = httprouter.HttpRouter()
    self.httplayer = httplayer.HttpLayer()

    #route events from httprouter to httplayer
    self.httprouter.createServerConnCallback = self.httplayer.createHttpTcpConnectionToServer
    self.httprouter.sendDataCallback = self.httplayer.sendHttpDataOnConnection
    self.httprouter.closeConnectionCallback = self.httplayer.closeHttpTcpConnection

    #route events from httplayer to httprouter
    self.httplayer.newBrowserCallback = self.httprouter.newBrowserConnection
    self.httplayer.dataArrivedCallback = self.httprouter.dataArrivedOnConnection
    self.httplayer.connectionLostCallback = self.httprouter.httpTcpConnectionLost

    #register callbacks with httplayer
    self.httplayer.closeTcpCallback = self.__closeTcpConnection
    self.httplayer.sendTcpDataCallback = self.__sendDataOnTcpConnection
    self.httplayer.createTcpConCallback = self.__createTcpConnection

  ################## BEGIN OUTPUT EVENTS TO LAYER 0 #####################

  def __closeTcpConnection(self, socket):
    self.closeTcpCallback(socket)

  def __sendDataOnTcpConnection(self, socket, data):
    self.sendTcpDataCallback(socket, data)

  def __createTcpConnection(self, host, portnum, callback):
    self.createTcpConCallback(host, portnum, callback)

  def __scheduleTimeout(delay, channel, obj):
    self.scheduleTimeoutHandler(delay, channel, obj)


  ##################  END OUTPUT EVENTS TO LAYER 0   #####################

  ################## BEGIN INPUT EVENTS FROM LAYER 0 #####################

  def init(self):
    #TODO: Handler here...
    pass

  def newHttpTcpConnection(self, socket):
    self.httplayer.newHttpTcpConnection(socket)

  def newTorTcpConnection(self, socket):
    #TODO: Handler here...
    pass

  def tcpConnectionLost(self, socket):
    self.httplayer.tcpConnectionLost(socket)
    #TODO: Also route to tor when that is here

  def dataArrivedOnTcpConnection(self, socket, data):
    self.httplayer.dataArrivedOnTcpConnection(socket, data)
    #TODO: Also route to tor when that is here

  def timeoutExpired(self, channel, obj):
    #TODO: Handler here...
    pass

  ################## END INPUT EVENTS FROM LAYER 0 #####################



