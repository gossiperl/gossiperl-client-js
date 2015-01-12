var dgram = require('dgram');

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
  this.socket = null;
  this.setup();
  console.log("[" + this.worker.config.clientName + "] UDP transport initialised.");
};
Gossiperl.Client.Transport.Udp.prototype.setup = function() {
  var _$self = this;
  this.socket = dgram.createSocket('udp4');
  this.socket.on('error', function(exception) {
    _$self.worker.listener.apply(_$self.worker, [ { event: 'failed', error: { reason: errorInfo, detail: 'Socket error.' } } ]);
  });
  this.socket.on('listening', function () {
    console.log("UDP socket bound to 127.0.0.1:" + _$self.worker.config.clientPort);
  });
  this.socket.on('message', function (message, remote) {
    // message is a buffer:
    try {
      var buffer = [];
      for ( var i=0; i<message.length; i++ ) {
        buffer.push( message.readUInt8(i) );
      }
      var receivedData = String.fromCharCode.apply(null, buffer);
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
  });

  this.socket.bind( this.worker.config.clientPort, '127.0.0.1' );
};

Gossiperl.Client.Transport.Udp.prototype.stop = function() {
  this.socket.close();
  this.socket = null;
}

Gossiperl.Client.Transport.Udp.prototype.send = function(digest, callback) {
  var serialized = this.serializer.serialize( digest );
  var encrypted  = this.encryption.encrypt( serialized );
  var buf = new Buffer(encrypted.length);
  for ( var i=0; i<encrypted.length; i++ ) {
    buf.writeInt8(encrypted.charCodeAt(i), i, true);
  }
  var _$self = this;
  if ( this.worker.working ) {
    this.socket.send( buf, 0, encrypted.length, this.worker.config.overlayPort, '127.0.0.1', function(err, bytes) {
      if (err) {
        _$self.worker.listener.apply(_$self.worker, [ { event: 'failed', error: { reason: err, detail: 'Digest not sent.' } } ]);
      } else {
        if (typeof(callback) !== 'undefined') {
          callback();
        }
      }
    });
  }
};