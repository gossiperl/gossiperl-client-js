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
