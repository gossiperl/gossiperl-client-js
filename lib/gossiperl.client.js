if (typeof Gossiperl === 'undefined') {
  Gossiperl = {};
}
if (typeof Gossiperl.Client === 'undefined') {
  Gossiperl.Client = {};
}
if (typeof Gossiperl.Client.Serialization === 'undefined') {
  Gossiperl.Client.Serialization = {};
}
if (typeof Gossiperl.Client.Encryption === 'undefined') {
  Gossiperl.Client.Encryption = {};
}
if (typeof Gossiperl.Client.Tests === 'undefined') {
  Gossiperl.Client.Tests = {};
}
if (typeof Gossiperl.Client.Transport === 'undefined') {
  Gossiperl.Client.Transport = {};
}
if (typeof Gossiperl.Client.Util === 'undefined') {
  Gossiperl.Client.Util = {};
}

/**
 * SUPERVISOR
 */

Gossiperl.Context = {
  'CHROME': 'chrome',
  'NODEJS': 'nodejs'
};

Gossiperl.CurrentContext = Gossiperl.Context.CHROME;

Gossiperl.Client.Supervisor = function() {
  this.connections = {};
};
Gossiperl.Client.Supervisor.prototype.connect = function(config, listener) {
  if ( this.isConnection( config.overlayName ) ) {
    throw new Error("Client for " + config.overlayName + " already present.");
  }
  var worker = new Gossiperl.Client.OverlayWorker(this, config, listener);
  this.connections[ config.overlayName ] = worker;
  worker.start();
}
Gossiperl.Client.Supervisor.prototype.disconnect = function(overlayName) {
  if ( this.isConnection( overlayName ) ) {
    this.connections[ overlayName ].stop();
  } else {
    throw new Error("[supervisor] No overlay connection: " + overlayName);
  }
}
Gossiperl.Client.Supervisor.prototype.disconnected = function(config) {
  // do not call directly:
  delete this.connections[ config.overlayName ];
}
Gossiperl.Client.Supervisor.prototype.subscribe = function(overlayName, events) {
  if ( this.isConnection( overlayName ) ) {
    return this.connections[ overlayName ].state.subscribe( events );
  } else {
    throw new Error("[supervisor] No overlay connection: " + overlayName);
  }
}
Gossiperl.Client.Supervisor.prototype.unsubscribe = function(overlayName, events) {
  if ( this.isConnection( overlayName ) ) {
    return this.connections[ overlayName ].state.unsubscribe( events );
  } else {
    throw new Error("[supervisor] No overlay connection: " + overlayName);
  }
}
Gossiperl.Client.Supervisor.prototype.send = function(overlayName, digestType, digestData) {
  if ( this.isConnection( overlayName ) ) {
    this.connections[overlayName].messaging.sendArbitrary(digestType, digestData);
  } else {
    throw new Error("[supervisor] No overlay connection: " + overlayName);
  }
}
Gossiperl.Client.Supervisor.prototype.read = function(digestType, binDigest, digestData) {
  
}
Gossiperl.Client.Supervisor.prototype.getCurrentState = function(overlayName) {
  if ( this.isConnection( overlayName ) ) {
    this.connections[ overlayName ].state.status;
  } else {
    throw new Error("[supervisor] No overlay connection: " + overlayName);
  }
}
Gossiperl.Client.Supervisor.prototype.getSubscriptions = function(overlayName) {
  if ( this.isConnection( overlayName ) ) {
    this.connections[ overlayName ].state.subscriptions;
  } else {
    throw new Error("[supervisor] No overlay connection: " + overlayName);
  }
}
Gossiperl.Client.Supervisor.prototype.getNumberOfConnections = function() {
  return _.keys(this.connections).length;
}
Gossiperl.Client.Supervisor.prototype.isConnection = function(overlayName) {
  return _.keys(this.connections).indexOf( overlayName ) > -1;
}
Gossiperl.Client.Supervisor.prototype.stop = function() {
  _.each(_.values(this.connections), function(worker) {
    worker.stop();
  });
}

/**
 * OVERLAY WORKER:
 */

Gossiperl.Client.OverlayWorker = function(supervisor, config, listener) {
  var defaultListener = function( e ) {
    switch (e.event) {
      case 'connected':
        console.log("[" + this.config.clientName + "] Connected to an overlay.");
        break;
      case 'disconnected':
        console.log("[" + this.config.clientName + "] Disconnected from an overlay.");
        break;
      case 'subscribed':
        console.log("[" + this.config.clientName + "] Subscribed to events: " + e.events + ".");
        break;
      case 'unsubscribed':
        console.log("[" + this.config.clientName + "] Unsubscribed from events: " + e.events + ".");
        break;
      case 'event':
        console.log("[" + this.config.clientName + "] Received member related event. Event type " + e.type + ", member " + e.member + ", heartbeat: " + e.heartbeat + ".");
        break;
      case 'forwardedAck':
        console.log("[" + this.config.clientName + "] Received confirmation of forwarded message. Message ID: " + e.replyId + ".");
        break;
      case 'forwarded':
        console.log("[" + this.config.clientName + "] Received forwarded digest " + e.binEnvelope + " of type " + e.digestType + " with ID " + e.envelopeId + ".");
        break;
      case 'failed':
        console.error("[" + this.config.clientName + "] Received a client error: " + e.error + ".");
        break;
      default:
        console.error("[" + this.config.clientName + "] Unsupported event: " + e + ".");
    }
  };
  this.supervisor = supervisor;
  this.config = config;
  this.listener = ( typeof(listener) === 'function' ? listener : defaultListener);
  this.messaging = new Gossiperl.Client.Messaging(this);
  this.state = new Gossiperl.Client.State(this);
  this.working = true;
  console.log("[" + config.clientName + "] Overlay worker initialised.");
};
Gossiperl.Client.OverlayWorker.prototype.start = function() {
  this.state.start();
}
Gossiperl.Client.OverlayWorker.prototype.stop = function() {
  var _$self = this;
  this.messaging.digestExit(function() {
    _$self.working = false;
    _$self.messaging.stop();
    _$self.supervisor.disconnected( _$self.config );
  });
}

/**
 * STATE:
 */

Gossiperl.Client.StateStatus = {
  'DISCONNECTED': 'disconnected',
  'CONNECTED':    'connected'
};

Gossiperl.Client.State = function(worker) {
  this.subscriptions = [];
  this.worker = worker;
  this.status = Gossiperl.Client.StateStatus.DISCONNECTED;
  this.lastTs = null;
  console.log("[" + this.worker.config.clientName + "] State initialised.");
}
Gossiperl.Client.State.prototype.start = function() {
  var _$self = this;
  setTimeout(function() {
    var work = function() {
      this.sendDigest.apply(this);
      if ( Gossiperl.Client.Util.getTimestamp() - this.lastTs > 5 ) {
        if (this.status === Gossiperl.Client.StateStatus.CONNECTED) {
          this.worker.listener.apply(this.worker, [ {event: 'disconnected'} ]);
        }
        this.status = Gossiperl.Client.StateStatus.DISCONNECTED;
      }
    };
    var f = function(func) {
      work.apply(this);
      var _$self = this;
      if (this.worker.working) {
        setTimeout(function() {
          func.apply(_$self, [func]);
        }, 2000);
      } else {
        this.worker.listener.apply(this.worker, [ {event: 'disconnected'} ]);
      }
    };
    f.apply(_$self, [f]);
  }, 1000);  
};
Gossiperl.Client.State.prototype.digestAck = function(ack) {
  if ( this.status === Gossiperl.Client.StateStatus.DISCONNECTED ) {
    this.worker.listener.apply(this.worker, [ {event: 'connected'} ]);
    if ( this.subscriptions.length > 0 ) {
      this.worker.messaging.digestSubscribe(this.subscriptions);
    }
  }
  this.status = Gossiperl.Client.StateStatus.CONNECTED;
  this.lastTs = ack.heartbeat;
}
Gossiperl.Client.State.prototype.sendDigest = function() {
  var digest = Gossiperl.Client.getAnnotatedDigest("Digest", {
    name: this.worker.config.clientName,
    port: this.worker.config.clientPort,
    heartbeat: Gossiperl.Client.Util.getTimestamp(),
    id: Gossiperl.Client.Util.getPseudoRandomMessageId(),
    secret: this.worker.config.clientSecret
  });
  this.worker.messaging.send( digest );
};
Gossiperl.Client.State.prototype.subscribe = function(events) {
  this.subscriptions = _.union( this.subscriptions, events );
  if ( this.status == Gossiperl.Client.StateStatus.CONNECTED ) {
    this.worker.messaging.digestSubscribe( events );
  }
  return this.subscriptions;
}
Gossiperl.Client.State.prototype.unsubscribe = function(events) {
  this.subscriptions = _.difference( this.subscriptions, events );
  if ( this.status == Gossiperl.Client.StateStatus.CONNECTED ) {
    this.worker.messaging.digestUnsubscribe( events );
  }
  return this.subscriptions;
}

/**
 * MESSAGING AND TRANSPORT:
 */

Gossiperl.Client.Messaging = function(worker) {
  this.worker = worker;
  this.transport = new Gossiperl.Client.Transport.Udp( this.worker );
  console.log("[" + this.worker.config.clientName + "] Messaging initialised.");
};
Gossiperl.Client.Messaging.prototype.digestAck = function(digest) {
  var ack = Gossiperl.Client.getAnnotatedDigest("DigestAck", {
    name: this.worker.config.clientName,
    secret: this.worker.config.clientSecret,
    reply_id: digest.id,
    heartbeat: Gossiperl.Client.Util.getTimestamp(),
    membership: []
  });
  this.send(ack);
};
Gossiperl.Client.Messaging.prototype.digestSubscribe = function(events) {
  var digest = Gossiperl.Client.getAnnotatedDigest("DigestSubscribe", {
    name: this.worker.config.clientName,
    secret: this.worker.config.clientSecret,
    id: Gossiperl.Client.Util.getPseudoRandomMessageId(),
    heartbeat: Gossiperl.Client.Util.getTimestamp(),
    event_types: events
  });
  this.send(digest);
};
Gossiperl.Client.Messaging.prototype.digestUnsubscribe = function(events) {
  var digest = Gossiperl.Client.getAnnotatedDigest("DigestUnsubscribe", {
    name: this.worker.config.clientName,
    secret: this.worker.config.clientSecret,
    id: Gossiperl.Client.Util.getPseudoRandomMessageId(),
    heartbeat: Gossiperl.Client.Util.getTimestamp(),
    event_types: events
  });
  this.send(digest);
};
Gossiperl.Client.Messaging.prototype.digestForwardedAck = function(replyId) {
  var digest = Gossiperl.Client.getAnnotatedDigest("DigestForwardedAck", {
    name: this.worker.config.clientName,
    secret: this.worker.config.clientSecret,
    reply_id: replyId
  });
  this.send(digest);
};
Gossiperl.Client.Messaging.prototype.digestExit = function(callback) {
  var digest = Gossiperl.Client.getAnnotatedDigest("DigestExit", {
    name: this.worker.config.clientName,
    secret: this.worker.config.clientSecret,
    heartbeat: Gossiperl.Client.Util.getTimestamp()
  });
  this.send(digest, callback);
  return true;
};
Gossiperl.Client.Messaging.prototype.send = function(digest, callback) {
  this.transport.send( digest, callback );
};
Gossiperl.Client.Messaging.prototype.sendArbitrary = function(digestType, digestData) {
  this.transport.sendArbitrary( digestType, digestData );
};
Gossiperl.Client.Messaging.prototype.receive = function(digest) {
  if ( digest.__annotated_type === 'Digest' ) {
    this.digestAck( digest );
  } else if ( digest.__annotated_type === 'DigestEvent' ) {
    this.worker.listener.apply(this.worker, [ { event: 'event',
                                                type: digest.event_type,
                                                member: digest.event_object,
                                                heartbeat: digest.heartbeat } ]);
  } else if ( digest.__annotated_type === 'DigestAck' ) {
    this.worker.state.digestAck( digest );
  } else if ( digest.__annotated_type === 'DigestSubscribeAck' ) {
    this.worker.listener.apply(this.worker, [ { event: 'subscribed',
                                                events: digest.event_types,
                                                heartbeat: digest.heartbeat } ]);
  } else if ( digest.__annotated_type === 'DigestUnsubscribeAck' ) {
    this.worker.listener.apply(this.worker, [ { event: 'unsubscribed',
                                                events: digest.event_types,
                                                heartbeat: digest.heartbeat } ]);
  } else if ( digest.__annotated_type === 'DigestForwardedAck' ) {
    this.worker.listener.apply(this.worker, [ { event: 'forwardedAck',
                                                replyId: digest.reply_id } ]);
  }
}
Gossiperl.Client.Messaging.prototype.receiveForward = function(forwardData) {
  this.worker.listener.apply( this.worker, [ { event: 'forwarded',
                                               binEnvelope: forwardData.envelope,
                                               envelopeId: forwardData.id,
                                               digestType: forwardData.type } ] );
  this.digestForwardedAck( forwardData.id );
}
Gossiperl.Client.Messaging.prototype.stop = function() {
  this.transport.stop();
}

// Transport is in the <platform>/transport.js file.

/**
 * SERIALIZER:
 */

Gossiperl.Client.Serialization.Serializer = function() {
  this.Type = {
    'DIGEST_ERROR': 'digestError',
    'DIGEST_FORWARDED_ACK': 'digestForwardedAck',
    'DIGEST_ENVELOPE': 'digestEnvelope',
    'DIGEST': 'digest',
    'DIGEST_ACK': 'digestAck',
    'DIGEST_SUBSCRIPTIONS': 'digestSubscriptions',
    'DIGEST_EXIT': 'digestExit',
    'DIGEST_SUBSCRIBE': 'digestSubscribe',
    'DIGEST_SUBSCRIBE_ACK': 'digestSubscribeAck',
    'DIGEST_UNSUBSCRIBE': 'digestUnsubscribe',
    'DIGEST_UNSUBSCRIBE_ACK': 'digestUnsubscribeAck',
    'DIGEST_EVENT': 'digestEvent'
  }
};

/**
 * Serialize arbitrary digest.
 * 
 * @param {String} digestType - type of the digest
 * @param {Array} digestData - array of digest data fields
 * 
 * Each field should contain following properties:
 *  - name: name of the field
 *  - value: value to write
 *  - id: numeric field id, starting from 0
 * For numeric types, a type_hint can be added; should be one of:
 *  - byte
 *  - i16
 *  - i32
 *  - i64
 *  - double
 * If no type_hint given, the library will attempt writing the number as i32.
 * 
 * @return {Array} serialized digest envelope
 */
Gossiperl.Client.Serialization.Serializer.prototype.serializeArbitrary = function(digestType, digestData) {
  var transport = Gossiperl.Client.Util.getThriftTransport();
  var protocol  = new Thrift.TBinaryProtocol( transport );
  protocol.writeStructBegin( digestType );
  digestData.forEach(function(field) {

    var fieldType = (function(f) {
      if (typeof(f.value) === 'string') {
        return Thrift.Type.STRING;
      } else if (typeof(f.value) === 'boolean') {
        return Thrift.Type.BOOL;
      } else if (typeof(f.value) === 'number') {
        if (f.hasOwnProperty("type_hint")) {
          switch (f.type_hint) {
            case "byte":
              return Thrift.Type.BYTE;
            case "i16":
              return Thrift.Type.I16;
            case "i32":
              return Thrift.Type.I32;
            case "i64":
              return Thrift.Type.I64;
            case "double":
              return Thrift.Type.DOUBLE;
            default:
              throw new Exception("[Serializer] Unsupported hint type for numeric data type: " + field.type_hint);
          }
        } else {
          return Thrift.Type.I32;
        }
      } else {
        throw new Exception("[Serializer] Not supprted serializable type: " + field.type);
      }
    })(field);
    
    protocol.writeFieldBegin( field.name, fieldType, field.id );
    switch (fieldType) {
      case Thrift.Type.BYTE:
        protocol.writeByte( field.value );
        break;
      case Thrift.Type.BOOL:
        protocol.writeBool( field.value );
        break;
      case Thrift.Type.I16:
        protocol.writeI16( field.value );
        break
      case Thrift.Type.I32:
        protocol.writeI32( field.value );
        break
      case Thrift.Type.I64:
        protocol.writeI64( field.value );
        break
      case Thrift.Type.DOUBLE:
        protocol.writeDouble( field.value );
        break
      case Thrift.Type.STRING:
        protocol.writeString( field.value );
        break;
    }
    protocol.writeFieldEnd();

  });
  protocol.writeFieldStop();
  protocol.writeStructEnd();

  var base64encoded = CryptoJS.enc.Base64.stringify(
                        Gossiperl.Client.Util.toCryptoJSWordArray(
                          Gossiperl.Client.Util.getBufferFromProtocol( protocol )
                        )
                      );

  var envelope = Gossiperl.Client.getAnnotatedDigest("DigestEnvelope", {
    payload_type: digestType,
    bin_payload: base64encoded,
    id: Gossiperl.Client.Util.getPseudoRandomMessageId()
  });
  return this.digestToBinary( envelope );
};

Gossiperl.Client.Serialization.Serializer.prototype.serialize = function(annotatedDigest) {
  var digestType = Gossiperl.Client.Util.lCaseFirst( annotatedDigest.__annotated_type );
  if (digestType == "digestEnvelope") {
    return annotatedDigest;
  }
  var serialized = this.digestToBinary( annotatedDigest );
  var base64encoded = CryptoJS.enc.Base64.stringify(
                        Gossiperl.Client.Util.toCryptoJSWordArray( serialized )
                      );
  var envelope = Gossiperl.Client.getAnnotatedDigest("DigestEnvelope", {
    payload_type: digestType,
    bin_payload: base64encoded,
    id: Gossiperl.Client.Util.getPseudoRandomMessageId()
  });
  return this.digestToBinary( envelope );
};

Gossiperl.Client.Serialization.Serializer.prototype.deserialize = function(binDigest) {
  var envelope = this.digestFromBinary( "DigestEnvelope", binDigest );
  if ( this.isGossiperlDigest( envelope.payload_type ) ) {
    var digestType = Gossiperl.Client.Util.uCaseFirst( envelope.payload_type );
    var rawDecoded = atob(envelope.bin_payload);
    var buf = Gossiperl.Client.Util.stringToByteArray(rawDecoded);
    var digest = this.digestFromBinary( digestType, buf );
    return digest;
  } else {
    return { forward: true, type: envelope.payload_type, envelope: binDigest, id: envelope.id };
  }
};

Gossiperl.Client.Serialization.Serializer.prototype.digestToBinary = function(digest) {
  var transport = Gossiperl.Client.Util.getThriftTransport();
  var protocol  = new Thrift.TBinaryProtocol( transport );
  digest.write(protocol); // any potential errors are being caught in the upper layer
  return Gossiperl.Client.Util.getBufferFromProtocol( protocol );
}

Gossiperl.Client.Serialization.Serializer.prototype.digestFromBinary = function(digestType, binDigest) {
  var transport = Gossiperl.Client.Util.getThriftTransport();
  var protocol  = new Thrift.TBinaryProtocol( transport );
  protocol = Gossiperl.Client.Util.setBufferOnProtocol(protocol, binDigest);
  var digest = Gossiperl.Client.getAnnotatedDigest(digestType);
  digest.read(protocol); // any potential errors are being caught in the upper layer
  return digest;
};

Gossiperl.Client.Serialization.Serializer.prototype.isGossiperlDigest = function(digest) {
  for (var key in this.Type) {
    if ( this.Type[key] === digest ) {
      return true;
    }
  }
  return false;
};

/**
 * ENCRYPTION:
 */

Gossiperl.Client.Encryption.Aes256 = function(symmetricKey) {
  this.key = CryptoJS.SHA256( symmetricKey );
};
Gossiperl.Client.Encryption.Aes256.prototype.encrypt = function(binary) {
  var wordArray = Gossiperl.Client.Util.toCryptoJSWordArray( binary );
  var iv = CryptoJS.lib.WordArray.random( 16 );
  var encrypted = CryptoJS.AES.encrypt( wordArray,
                                        this.key,
                                        { iv: iv, format: CryptoJS.format.OpenSSL } ).ciphertext;
  var ivStr = iv.toString(CryptoJS.enc.Latin1);
  return ivStr + encrypted.toString(CryptoJS.enc.Latin1);
};
Gossiperl.Client.Encryption.Aes256.prototype.decrypt = function(data) {
  var iv = data.substring(0,16);
  var encrypted = data.substr(16);
  var decrypted = CryptoJS.AES.decrypt( { ciphertext: CryptoJS.enc.Latin1.parse(encrypted) },
                                          this.key,
                                          { iv: CryptoJS.enc.Latin1.parse(iv), format: CryptoJS.format.OpenSSL, padding: CryptoJS.pad.NoPadding } ).toString(CryptoJS.enc.Latin1);
  return Gossiperl.Client.Util.stringToByteArray(decrypted);
};

/**
 * UTILITIES:
 */

Gossiperl.Client.Util = function() {}
Gossiperl.Client.Util.byteArrayToString = function(barr) {
  return String.fromCharCode.apply(null, barr);
};
Gossiperl.Client.Util.stringToByteArray = function(str) {
  var buf = [];
  for (var i=0; i<str.length; i++) {
    buf.push( str.charCodeAt(i) );
  }
  return buf;
};
Gossiperl.Client.Util.toCryptoJSWordArray = function(bArr) {
  var words = [];
  for (var i = 0; i < bArr.length; i++) {
    words[i >>> 2] |= (bArr[i] & 0xff) << (24 - (i % 4) * 8);
  }
  return new CryptoJS.lib.WordArray.init(words, bArr.length);
};
Gossiperl.Client.Util.lCaseFirst = function(str) {
  return str.substring(0,1).toLowerCase() + str.substring(1,str.length);
};
Gossiperl.Client.Util.uCaseFirst = function(str) {
  return str.substring(0,1).toUpperCase() + str.substring(1,str.length);
};
Gossiperl.Client.Util.getTimestamp = function() {
  return parseInt(Date.now()/1000);
};
Gossiperl.Client.Util.getPseudoRandomMessageId = function() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
    return v.toString(16);
  });
};

Gossiperl.Client.Util.getThriftTransport = function() {
  if (Gossiperl.CurrentContext == Gossiperl.Context.CHROME) {
    return new Thrift.TWebSocketTransport("http://dummy");
  } else if (Gossiperl.CurrentContext == Gossiperl.Context.NODEJS) {
    return new Thrift.TFramedTransport();
  } else {
    throw Error("Unknown gossiperl context: " + Gossiperl.CurrentContext);
  }
};

Gossiperl.Client.Util.getBufferFromProtocol = function(protocol) {
  if (Gossiperl.CurrentContext == Gossiperl.Context.CHROME) {
    return protocol.buffer;
  } else if (Gossiperl.CurrentContext == Gossiperl.Context.NODEJS) {
    var buffer = [];
    for ( var i=0; i<protocol.trans.outBuffers.length; i++ ) {
      for ( var j=0; j<protocol.trans.outBuffers[i].length; j++ ) {
        buffer.push( protocol.trans.outBuffers[i].readUInt8(j) );
      }
    }
    return buffer;
  } else {
    throw Error("Unknown gossiperl context: " + Gossiperl.CurrentContext);
  }
};

Gossiperl.Client.Util.setBufferOnProtocol = function(protocol, buffer) {
  if (Gossiperl.CurrentContext == Gossiperl.Context.CHROME) {
    protocol.buffer = buffer;
    return protocol;
  } else if (Gossiperl.CurrentContext == Gossiperl.Context.NODEJS) {
    var inBuffer = new Buffer( buffer.length );
    for ( var i=0; i<buffer.length; i++ ) {
      inBuffer.writeInt8(buffer[i], i, true);
    }
    protocol.trans.inBuf = inBuffer;
    return protocol;
  } else {
    throw Error("Unknown gossiperl context: " + Gossiperl.CurrentContext);
  }
};

Gossiperl.Client.getAnnotatedDigest = function(name, args) {
  var scope = (Gossiperl.CurrentContext == Gossiperl.Context.CHROME) ? window : global;
  var cls = scope["Gossiperl"]["Client"]["Thrift"][name];
  if (typeof cls === "function") {
    var options = args || {};
    var inst = new cls( options );
    inst.__annotated_type = name;
    return inst;
  } else {
    throw new Error("Digest " + name + " does not exist.");
  }
};
