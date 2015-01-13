if (typeof Gossiperl === 'undefined') {
  Gossiperl = {};
}
if (typeof Gossiperl.Client === 'undefined') {
  Gossiperl.Client = {};
}
if (typeof Gossiperl.Client.Transport === 'undefined') {
  Gossiperl.Client.Transport = {};
}

Gossiperl.Client.Transport.Udp = function(worker) {
  this.worker = worker;
  this.serializer = new Gossiperl.Client.Serialization.Serializer();
  this.encryption = new Gossiperl.Client.Encryption.Aes256( this.worker.config.symmetricKey );
  this.socketId = null;
  this.setup();
  console.log("[" + this.worker.config.clientName + "] UDP transport initialised.");
};
Gossiperl.Client.Transport.Udp.prototype.setup = function() {
  var _$self = this;
  chrome.sockets.udp.create({}, function(createInfo) {
    chrome.sockets.udp.bind(createInfo['socketId'], "127.0.0.1", _$self.worker.config.clientPort, function(result) {
      if (result >= 0) {
        console.log("UDP socket bound to 127.0.0.1:" + _$self.worker.config.clientPort);
        _$self.socketId = createInfo['socketId'];
        chrome.sockets.udp.onReceive.addListener(function(incomingInfo) {
          if (incomingInfo.socketId === _$self.socketId) {
            try {
              var receivedData = String.fromCharCode.apply(null, new Uint8Array(incomingInfo.data));
              try {
                var decrypted = _$self.encryption.decrypt( receivedData );
                try {
                  var deserialized = _$self.serializer.deserialize( decrypted );
                  if ( typeof(deserialized.__annotated_type) !== 'undefined' ) {
                    _$self.worker.messaging.receive( deserialized );
                  } else {
                    _$self.worker.messaging.receiveForward( deserialized );
                  }
                } catch (e) {
                  _$self.worker.listener.apply(_$self.worker, [ { event: 'failed', error: { reason: e, detail: 'Error while deserializing digest.' } } ]);
                }
              } catch (e) {
                _$self.worker.listener.apply(_$self.worker, [ { event: 'failed', error: { reason: e, detail: 'Error while decrypting digest.' } } ]);
              }
            } catch (e) {
              _$self.worker.listener.apply(_$self.worker, [ { event: 'failed', error: { reason: e, detail: 'Error while receiving the data.' } } ]);
            }
          }
        });
        chrome.sockets.udp.onReceiveError.addListener(function(errorInfo) {
          _$self.worker.listener.apply(_$self.worker, [ { event: 'failed', error: { reason: errorInfo, detail: 'Socket error.' } } ]);
        });
      } else {
        console.error("Could not bind UDP socket to 127.0.0.1:" + _$self.worker.config.clientPort);
      }
    });
  });
};

Gossiperl.Client.Transport.Udp.prototype.stop = function() {
  var _$self = this;
  chrome.sockets.udp.send(this.socketId, function() {
    _$self.socketId = null;
  });
}

Gossiperl.Client.Transport.Udp.prototype.sendArbitrary = function(digestType, digestData) {
  var serialized = this.serializer.serializeArbitrary( digestType, digestData );
  var encrypted  = this.encryption.encrypt( serialized );
  this.sendEncrypted( encrypted );
}

Gossiperl.Client.Transport.Udp.prototype.send = function(digest, callback) {
  var serialized = this.serializer.serialize( digest );
  var encrypted  = this.encryption.encrypt( serialized );
  this.sendEncrypted( encrypted, callback )
};

Gossiperl.Client.Transport.Udp.prototype.sendEncrypted = function(encrypted, callback) {
  var buf = new ArrayBuffer(encrypted.length);
  var bufView = new Uint8Array(buf);
  for ( var i=0; i<encrypted.length; i++ ) {
    bufView[i] = encrypted.charCodeAt(i);
  }
  var _$self = this;
  if ( this.worker.working ) {
    chrome.sockets.udp.send(this.socketId, buf, "127.0.0.1", this.worker.config.overlayPort, function(sendInfo) {
      if ( sendInfo.resultCode < 0 ) {
        _$self.worker.listener.apply(_$self.worker, [ { event: 'failed', error: { reason: sendInfo, detail: 'Digest not sent.' } } ]);
      } else {
        if (typeof(callback) !== 'undefined') {
          callback();
        }
      }
    });
  }
};