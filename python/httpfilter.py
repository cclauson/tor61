#an http filter only has only two methods.
#"process more data" takes string
#data from inside an http request, and
#returns "translated" string data.  It
#will generally be similar to what was
#provided as a parameter, but parts of
#it may be translated, also some data
#might be buffered, so not all will come
#back immediately.
#An HttpFilter has properties that can
#be checked.  The important one
#is "headerDone".  If this is true, then
#the entire Http header has been seen,
#so we can call the method "getHostPortnum"
#to get the host and portnum.
#BE SURE TO CHECK IF HOST COMES BACK AS
#PYTHON "NONE"!!  If this is the case,
#assuming the method wasn't called too
#early, then we weren't able to get a
#hostname from the http request, it should
#probably be ignored
#One thing that is also true is that
#after "headerDone" is true, there
#is no processing at all by "processMoreData",
#and all the cache is flushed, basically
#at this point the filter does nothing.
class HttpFilter:

  def __init__(self):
    #flag to indicate whether or
    #not the entire header has
    #been processed yet
    self.headerDone = False
    #flag to indicate first line
    #seen
    self.firstLineSeen = False
    #until we've processed the
    #header, we may cache partial
    #lines
    self.cache = ""
    #Contents of host field
    self.hostFromHostHeader = None
    #also cache from first line for cases
    #where host header doesn't exist
    self.hostFromFirstLine = None
    #if host header gives port num cache it
    self.portnum = None
    #also cache first line, but minus the
    #HTTP/1.x part
    self.firstLine = None

  #here is where we will modify the
  #header line based on its content,
  #also capture any information that
  #we would like to save
  def __modifyLine(self, line):
    toks = line.split()
    if len(toks) == 0:
      return line
    if self.firstLineSeen:
      if len(toks) != 2:
        #just ignore
        return line
      else:
        if toks[0].lower() == 'host:':
          self.hostFromHostHeader = toks[1]
          #check for port number too
          subtoks = toks[1].split(':')
          if len(subtoks) == 2:
            self.portnum = int(subtoks[1])
          return line
        elif toks[0].lower() == 'connection:':
          toks[1] = 'close'
        elif toks[0].lower() == 'proxy-connection:':
          toks[1] = 'close'
        else:
          return line
        return ' '.join(toks)
    else:
      self.firstLineSeen = True
      #expect an HTTP request line
      if len(toks) != 3:
        #strange...I guess just ignore
        return line
      else:
        self.firstLine = toks[0] + ' ' + toks[1]
        self.hostFromFirstLine = toks[1]
        #switch protocol to 1.0
        toks[2] = 'HTTP/1.0'
        return ' '.join(toks)


  def processMoreData(self, data):
    #print "filteringData: {}".format(data)
    if self.headerDone:
      #after header there's nothing to do
      return data
    else:
      self.cache = self.cache + data
      lines = self.cache.split('\n')
      ret = ''
      while len(lines) > 1:
        line = lines.pop(0)
        #print "Processing line: {}".format(line)
        #if line.strip() == '':
        #  print "Whitespace line of length {}".format(len(line))
        #I thought according to the spec it was supposed to be an
        #empty line, not a line of whitespace only, but oh well
        if line.strip() == '':
          #end of header
          ret = ret + '\n' + '\n'.join(lines)
          lines = []
          #print "Seen header!"
          self.headerDone = True
        else:
          ret = ret + self.__modifyLine(line) + '\n'
      if lines:
        self.cache = lines[0]
      return ret

  #NOTE: Caller should check if returned host
  #is "None", if it is, then we weren't able
  #to get it from the header (of this method
  #was called before "headerDone" is true
  def getHostPortnum(self):
    destHost = self.hostFromHostHeader
    if destHost == None:
      destHost = self.hostFromFirstLine
    portnum = self.portnum
    if portnum == None:
      portnum = 80
    return (destHost, portnum)

