import socket, select, threading, sys, os, heapq

#for now, hard code http and tor
#port numbers
httpTcpPornum = 8080
torTcpPortnum = 8081
#Not sure, this might have to
#change to '0.0.0.0' eventually
bindhost = 'localhost'

#if a tcp socket is unavailable for
#write for this many seconds, then
#we time out
socketWriteTimoutSecs = 10.0

#create a non-blocking server socket at the
#given port
def constructServerSocket(portnum):
  sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
  sock.bind((bindhost, portnum))
  sock.setblocking(0)
  sock.listen(10)
  return sock


#function to dispose of a socket that we no
#longer need for whatever reason and need
#to shut down, does not include removing
#from hashmaps, etc., do that separately
def doSocketDisposal(socket):
  #The idea here is to try to send a
  #FIN to the other side, but if this
  #is impossible (or possibly already
  #done) and results in an exception
  #then actually just ignore it
  try:
    readsocket.shutdown(socket.SHUT_RDWR)
  except socket.error as e:
    pass
  try:
    readsocket.shutdown(socket.SHUT_WR)
  except socket.error as e:
    pass
  try:
    readsocket.shutdown(socket.SHUT_RD)
  except socket.error as e:
    pass
  try:
    readsocket.close()
  except socket.error as e:
    pass


# Create a TCP/IP sockets
httpServerSocket = constructServerSocket(httpTcpPornum)
torServerSocket = constructServerSocket(torTcpPortnum)

#non-server sockets, key is actual socket, value
#is (string, object) pair.  The string is the write
#buffer representing data we need to write, the
#object is a timeout object representing the write
#timout for this socket.  If the write timeout
#is None, then there is no timeout.  The reference
#to this object is retained because it allows us
#to cancel scheduled timeouts.
nonServerSockets = {}

#because the creation of a TCP connection involves updating
#this map, we create a lock for it, we need to acquire
#this lock every time we want to access the nonServerSockets
#hashmap
socketMapLock = threading.Lock()
#NOTE: Based on a quick Google search, there's some reason
#to think that map operations in python are atomic, but
#let's do this anyways, it doesn't hurt, anyways it's basically
#what you would want to do in C or Java


#############################################################
#
#                LAYER 0 OUTPUT EVENTS
#
#############################################################

def init():
  #TODO: Handler here...
  pass

def newHttpTcpConnection(socket):
  #TODO: Handler here...
  pass

def newTorTcpConnection(socket):
  #TODO: Handler here...
  pass

def tcpConnectionLost(socket)
  #TODO: Handler here...
  pass

def dataArrivedOnTcpConnection(socket, data)
  #TODO: Handler here...
  pass

def timeoutExpired(channel, obj):
  #TODO: Handler here...
  pass

################## END OUTPUT EVENTS #######################

#Queue for timeout events, organized as a heap-based
#priority queue.  It should only be modified using
#functions from the python heapq module.
#Objects on this queue should be (time, channel, obj)
#triples--the time is a floating point number in seconds
#(absolute epoch time) which indicates when this event
#will "mature", i.e., be ready to deliver.  The "channel"
#parameter is an integer which we will use for multiplexing.
#The "obj" is the timeout object given by the event.
#We optionally allow the timeout object to have an
#"isCancelled" property, if this property is true then
#we won't deliver the timeout.  This allows the party
#that scheduled the timeout to reserve the option to
#cancel by maintaining a reference to the object, to
#cancel, set "isCancelled" to true
timeoutQueue = []

#small time delta, basically, if we are checking the
#queue and within this number of seconds from an event,
#treat this event as occurring now
timeDelta = 0.02

#variable to track current time, it will be a floating point
#number representing absolute (epoch) time in seconds.
#This needs to be updated every time we return from a select()
#call
currTime = time.time()

#Make a timeout lock, since we can imagine a situation
#where a TCP connection creation thread delivers an event
#indicating that connection was successful, this thread
#could come back to send data over TCP, which would result
#in a timeout being scheduled
timeoutQueueLock = threading.Lock()

def doTimeoutSchedule(delay, channel, obj):
  #in python, heapq is a minqueue, and will sort on the first
  #value of a tuple, therefore we push a triple where the first
  #value is the timeout time
  timeoutQueueLock.acquire()
  heapq.heappush(timeoutQueue, (currTime + delay, channel, obj))
  timeoutQueueLock.release()

#very simple generic class to represent a cancellable timout
class CancellableTimeout:
  def __init__(self):
    self.isCancelled = False


#We will need threads in this layer for creation of TCP
#connections, so we create a lock, any time an output
#event function is called, the lock should be acquired,
#then released after we return
outputSynchronizationLock = threading.Lock()
#VERY IMPORTANT NOTE: It would be a programming error
#for a thread which arrived on an input event function
#to try to acquire this lock, the lock will already
#have been acquired and this would lead to deadlock

#function for creating a TCP connection, this will be
#called on a new thread each time we want to create
#a connection
def doTcpCreate((host, portnum, callback)):
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
      sock.connect((host, portnum))
      #success
      timout = None
      socketMapLock.acquire()
      nonServerSockets[sock] = ('', timout)
      socketMapLock.release()
      #do callback
      outputSynchronizationLock.acquire()
      callback(sock)
      outputSynchronizationLock.release()
    except socket.err as e:
      #failure
      doSocketDisposal(sock)
      outputSynchronizationLock.acquire()
      callback(None)
      outputSynchronizationLock.release()


#############################################################
#
#                 LAYER 0 INPUT EVENTS
#
#############################################################

def closeTcpConnection(socket):
  socketMapLock.acquire()
  if socket in nonServerSockets.keys():
    #Let's cancel the timeout, it shouldn't break
    #if we don't but it's slightly more efficient
    buf, timeout = nonServerSockets[socket]
    if timeout != None
      timeout.isCancelled = True
    del nonServerSockets[readsocket]
    socketMapLock.release()
    doSocketDisposal(readsocket)
  else:
    socketMapLock.release()
    raise ValueError('request came to close socket, but this socket is not open')

def sendDataOnTcpConnection(socket, data):
  socketMapLock.acquire()
  if socket in nonServerSockets.keys():
    #we just buffer it to send later
    buf, timeout = nonServerSockets[socket]
    buf = buf + data
    #also, if no timeout exists and the buffer isn't empty, we need to schedule one
    if buf != '' and timeout == None:
      timout = CancellableTimeout()
      #also put a reference to the socket in the timeout
      timeout.socket = socket
      doTimeoutSchedule(socketWriteTimoutSecs, -1, timeout)
    nonServerSockets[socket] = (buf, timeout)
    socketMapLock.release()
  else:
    socketMapLock.release()
    raise ValueError('request came to send data on socket, but this socket is not open')

#NOTE: Callback takes one parameter, the socket.  It will
#be Python "None" on failure
def createTcpConnection(host, portnum, callback)
  #we create new thread, since blocking our thread on tcp port
  #creation is inefficient, and could actually lead to deadlock
  #in a situation where we are connecting to ourselves.
  #However, we use synchronization locks to limit access to certain
  #resources to one thread at a time, these two resources being
  #the non server socket map and the upper layer event delivery interface
  threading.start_new_thread(doTcpCreate, (host, portnum, callback))

def scheduleTimeout(delay, channel, obj):
  if channel < 0:
    raise ValueError('got channel {}, but these channels are reserved')
  else:
    doTimeoutSchedule(delay, channel, obj)

################### END INPUT EVENTS ########################


#call init before entering in to event loop
init()

while True:

  inputs = [httpServerSocket, torServerSocket]
  outputs = []
  errs = []

  socketMapLock.acquire()
  inputs.extend(nonServerSockets.keys())
  outputs.extend(nonServerSockets.keys())
  socketMapLock.release()

  #at this point, we remove all cancelled timeouts
  #from the top of the timeout queue, this means
  #that we will not spuriously wake up from select()
  timeoutQueueLock.acquire()
  while timeoutQueue:
    time, channel, obj = timeoutQueue[0]
    if hasattr(obj, 'isCancelled') and obj.isCancelled:
      heapq.heappop(timeoutQueue)
    else:
      break
  timeoutQueueLock.release()
  
  try:
    ready_to_read, ready_to_write, in_error = ([], [], [])
    if timeoutQueue:
      #recompute currTime, we need it to schedule timeout
      currTime = time.time()
      #we get the timeout value from the next element on the
      #timeout queue
      ready_to_read, ready_to_write, in_error = select.select(
                  potential_readers,
                  potential_writers,
                  potential_errs, timeoutQueue[0][0] - currTime)
    else:
      ready_to_read, ready_to_write, in_error = select.select(
                  potential_readers,
                  potential_writers,
                  potential_errs)
    currTime = time.time()
  except select.error as e:
    currTime = time.time()
    #According to documentation, there's some problem with
    #some socket that we're selecting on, so we need to
    #select on each one with a zero timeout to figure out
    #which is the problem
    #let's do that, when we find the problematic one
    #we'll treat it as bad and drop it
    for readsock in potential_readers:
      try:
        ready_to_read, ready_to_write, in_error = select.select(
                  [readsock], [], [], 0)
      except select.error as e:
        socketMapLock.acquire()
        if readsock in nonServerSockets.keys():
          buf, timeout = nonServerSockets[readsock]
          if timeout != None
            timeout.isCancelled = True
          del nonServerSockets[readsock]
          socketMapLock.release()
          doSocketDisposal(readsock)
          outputSynchronizationLock.acquire()
          tcpConnectionLost(readsock)
          outputSynchronizationLock.release()
        else:
          socketMapLock.release()
          #it's a server listening socket, we would like to
          #shut it down, and restart
          #probably we can just shut down the same way as a
          #normal socket?
          #TODO: Handle this, for now we will ignore, but this
          #is fatal.  One possibility is that we try to restart
          #the tcp listening socket every 30 seconds or so...
          pass
    for writesock in potential_writers:
      try:
        ready_to_read, ready_to_write, in_error = select.select(
                  [], [writesock], [], 0)
      except select.error as e:
        socketMapLock.acquire()
        buf, timeout = nonServerSockets[writesock]
        if timeout != None
          timeout.isCancelled = True
        del nonServerSockets[writesock]
        socketMapLock.release()
        doSocketDisposal(writesock)
        outputSynchronizationLock.acquire()
        tcpConnectionLost(writesock)
        outputSynchronizationLock.release()
    #now that offending sockets are corrected,
    #loop back and select() again
    continue

  #let's deliver all timeout events now
  timeoutQueueLock.acquire()
  while timeoutQueue:
    time, channel, obj = heapq.heappop(timeoutQueue)
    if hasattr(obj, 'isCancelled') and obj.isCancelled:
      #we encountered a cancelled event, ignore it
      continue
    if time > currTime + timeDelta:
      #all remaining events on queue are in the future,
      #so nothing more to do
      break;
    if channel > 0:
      if channel == -1:
        #timeout related to sending sockets
        sock = obj.socket
        #basically, there has been data on this socket
        #for the entire timeout period, but it has not
        #been available to send, so we tear down
        #IMPORTANT: Don't deliver an event while holding
        #the timeoutQueue lock, this could lead to deadlock!!!
        timeoutQueueLock.release()
        doSocketDisposal(sock)
        outputSynchronizationLock.acquire()
        tcpConnectionLost(sock)
        outputSynchronizationLock.release()
        socketMapLock.acquire()
        del nonServerSockets[sock]
        socketMapLock.release()
        timeoutQueueLock.acquire()
      else:
        raise RuntimeError("Timeout occurred on unexpected channel: {}".format(channel))
    else:
      #this is an upper layer timeout event
      timeoutExpired(channel, obj)
  timeoutQueueLock.release()

  for readsocket in ready_to_read:
    if readsocket == httpServerSocket or readsocket == torServerSocket:
      try:
        conn, addr = readsocket.accept()
        #make it nonblocking
        conn.setblocking(0)
        #We now have a connection, so cache and
        #send notification event
        #Hashmap value is a pair, first member
        #is data waiting to be sent, initally
        #a string, second is timeout object,
        #representing an active timeout
        #on this object's ability to send data
        #(i.e., if a long time passes during
        #which it is unavailable for send, then
        #time out)
        timeout = None
        socketMapLock.acquire()
        nonServerSockets[conn] = ('', timeout)
        socketMapLock.release()
        if readsocket == httpServerSocket:
          outputSynchronizationLock.acquire()
          newHttpTcpConnection(conn)
          outputSynchronizationLock.release()
        else:
          outputSynchronizationLock.acquire()
          newTorTcpConnection(conn)
          outputSynchronizationLock.release()
      except socket.err as e:
        #I think this happens if there is
        #no data on the socket which shouldn't
        #happen but anyways
        continue
    else:
      socketMapLock.acquire()
      if readsocket in nonServerSockets.keys():
        socketMapLock.release()
        try:
          dat = readsocket.recv(1024)
          if dat:
            #send data along to upper layer(s)
            outputSynchronizationLock.acquire()
            dataArrivedOnTcpConnection(dat)
            outputSynchronizationLock.release()
          else:
            #This indicates that the other side
            #has shut down the connection with FIN
            #notify layer 0 users
            outputSynchronizationLock.acquire()
            tcpConnectionLost(readsocket)
            outputSynchronizationLock.release()
            #next call should send our own FIN
            #and free socket resources
            doSocketDisposal(readsocket)
            #need to remove from hashmap
            socketMapLock.acquire()
            buf, timeout = nonServerSockets[socket]
            if timeout != None
              timeout.isCancelled = True
            del nonServerSockets[readsocket]
            socketMapLock.release()
        except socket.err as e:
          #some error with the socket, let's
          #assume that this TCP connection
          #is bad
          outputSynchronizationLock.acquire()
          tcpConnectionLost(readsocket)
          outputSynchronizationLock.release()
          doSocketDisposal(readsocket)
          socketMapLock.acquire()
          buf, timeout = nonServerSockets[socket]
          if timeout != None
            timeout.isCancelled = True
          del nonServerSockets[readsocket]
          socketMapLock.release()
      else:
        socketMapLock.release()
        #This should actually never happen
        raise RuntimeError("unknown socket ready for read from select call")

  for writesocket in ready_to_write:
    #we'll just keep the socket map lock for the
    #entire write, the write should be fast
    #(nonblocking) and in the worst case all that
    #happens is that a TCP creation is slowed down
    #slightly
    socketMapLock.acquire()
    if writesocket in nonServerSockets.keys():
      dat, timeout = nonServerSockets[writesocket]
      try:
        sent = writesocket.send(dat)
        if sent == 0:
          #Do nothing
          pass
        else:
          #remove written data from the queue and
          #cancel timeout
          dat = dat[sent:]
          timeout.isCancelled = True
          #reschedule if we still have data
          if dat != '':
            timeout = CancellableTimeout()
            #also put a reference to the socket in the timeout
            timeout.socket = writesocket
            doTimeoutSchedule(socketWriteTimoutSecs, -1, timeout)
          else:
            timeout = None
          nonServerSockets[writesocket] = (data, timeout)
          socketMapLock.release()
      except socket.err as e:
        #some error with the socket, let's
        #assume that this TCP connection
        #is bad
        outputSynchronizationLock.acquire()
        tcpConnectionLost(readsocket)
        outputSynchronizationLock.release()
        doSocketDisposal(readsocket)
        buf, timeout = nonServerSockets[socket]
        if timeout != None
          timeout.isCancelled = True
        del nonServerSockets[readsocket]
        socketMapLock.release()
    else:
      #this can only happen if the socket was
      #ready for both read and write, but it
      #had some problem so we disposed of it,
      #so just ignore it
      pass
      socketMapLock.release()




