var testCase  = require('nodeunit').testCase;
require('../lib/gossiperl.client.node.js');

var serializer = new Gossiperl.Client.Serialization.Serializer();
var clientName = "chrome-test-client";
var clientPort = 54321;
var clientSecret = "chrome-client-secret";
var symmetricKey = "v3JElaRswYgxOt4b";
var overlayName = "gossiper_overlay_remote";
var overlayPort = 6666;
var events = ["member_in", "digestForwardableTest"];

module.exports = testCase({

  "Gossiperl context": function(test) {
    test.equal( Gossiperl.CurrentContext, Gossiperl.Context.NODEJS );
    test.done();
  },

  "Process": function(test) {
    var supervisor = new Gossiperl.Client.Supervisor();
    test.equal(supervisor.getNumberOfConnections(),0);
    var config = {
      overlayName:  overlayName,
      overlayPort:  overlayPort,
      clientName:   clientName,
      clientPort:   clientPort,
      clientSecret: clientSecret,
      symmetricKey: symmetricKey
    };
    supervisor.connect(config);
    test.equal(supervisor.getNumberOfConnections(),1);
    
    setTimeout(function() {
      
      var resp = supervisor.subscribe( config.overlayName, events );
      test.deepEqual(resp, events);

      setTimeout(function() {
        
        var resp = supervisor.unsubscribe( config.overlayName, events );
        test.deepEqual(resp, []);

        setTimeout(function() {

          supervisor.disconnect( config.overlayName );

          setTimeout(function() {
            
            test.equal(supervisor.getNumberOfConnections(),0);
            test.done();

          }, 1500);
        }, 3000);
      }, 3000);
    }, 3000);
  },

  "Simple serialize / deserialize": function(test) {
    var digest = Gossiperl.Client.getAnnotatedDigest("Digest", {
      name: clientName,
      port: clientPort,
      heartbeat: Gossiperl.Client.Util.getTimestamp(),
      id: Gossiperl.Client.Util.getPseudoRandomMessageId(),
      secret: clientSecret
    });
    var serialized = serializer.serialize( digest );
    var deserialized = serializer.deserialize( serialized );
    test.equal( deserialized.name, clientName );
    test.equal( deserialized.port, clientPort );
    test.equal( deserialized.heartbeat, digest.heartbeat );
    test.equal( deserialized.id, digest.id );
    test.equal( deserialized.secret, clientSecret );
    test.done();
  },

  "Serialize / deserialize arbitrary": function(test) {
    var digestType = "customDigest";
    
    var digestData = [
      { name: 'property1', value: "Some string value", id: 0 },
      { name: 'property_bool', value: true, id: 1 },
      { name: 'and_an_i16', value: 123, id: 2, type_hint: 'i16' } ];
    
    var digestInfo = [
      { name: 'property1', value: "", id: 0 },
      { name: 'property_bool', value: false, id: 1 },
      { name: 'and_an_i16', value: 0, id: 2, type_hint: 'i16' } ];
    
    var serialized = serializer.serializeArbitrary( digestType, digestData );
    var deserialized = serializer.deserializeArbitrary( digestType, serialized, digestInfo );
    
    test.ok( true, deserialized.hasOwnProperty('property1') );
    test.ok( true, deserialized.hasOwnProperty('property_bool') );
    test.ok( true, deserialized.hasOwnProperty('and_an_i16') );

    test.equal( digestData[0].value, deserialized['property1'] );
    test.equal( digestData[1].value, deserialized['property_bool'] );
    test.equal( digestData[2].value, deserialized['and_an_i16'] );

    test.done();
  },

  "Serialize / deserialize with encryption": function(test) {
    var aes = new Gossiperl.Client.Encryption.Aes256( symmetricKey );
    var digest = Gossiperl.Client.getAnnotatedDigest("Digest", {
      name: clientName,
      port: clientPort,
      heartbeat: Gossiperl.Client.Util.getTimestamp(),
      id: Gossiperl.Client.Util.getPseudoRandomMessageId(),
      secret: clientSecret
    });
    var serialized = serializer.serialize( digest );
    var encrypted = aes.encrypt( serialized );
    var decrypted = aes.decrypt( encrypted );
    var deserialized = serializer.deserialize( decrypted );

    test.equal( deserialized.name, clientName );
    test.equal( deserialized.port, clientPort );
    test.equal( deserialized.heartbeat, digest.heartbeat );
    test.equal( deserialized.id, digest.id );
    test.equal( deserialized.secret, clientSecret );
    test.done();
  }

});
