# JavaScript gossiperl client libraries

JavaScript gossiperl client libraries with Node.JS wrappers.

# Using with Node.JS

Add a dependency in your package.json:

    "gossiperl-client-js": "git://github.com/gossiperl/gossiperl-client-js.git"

In your code:

    require('gossiperl-client-js');

# Using with Bower

Add a dependency in your bower.json:

    "gossiperl-client-js": "gossiperl/gossiperl-client-js"

And in your HTML:

    <!-- gossiperl: -->
    <script type="text/javascript" src="/bower_components/gossiperl-client-js/lib/types/chrome/gossiperl_types.js"></script>
    <script type="text/javascript" src="/bower_components/gossiperl-client-js/lib/transport/chrome/transport.js" charset="utf-8"></script>
    <script type="text/javascript" src="/bower_components/gossiperl-client-js/lib/gossiperl.client.js" charset="utf-8"></script>

# Running

    var supervisor = new Gossiperl.Client.Supervisor();

# Connecting to an overlay

    supervisor.connect({
      overlayName:  "gossiper_overlay_remote",
      overlayPort:  6666,
      clientName:   "client-js",
      clientPort:   54321,
      clientSecret: "js-client-secret",
      symmetricKey: "v3JElaRswYgxOt4b"
    });

Connecting with the listener:

    supervisor.connect({
      overlayName:  "gossiper_overlay_remote",
      overlayPort:  6666,
      clientName:   "client-js",
      clientPort:   54321,
      clientSecret: "js-client-secret",
      symmetricKey: "v3JElaRswYgxOt4b"
    }, function( eventData ) {
      console.log( eventData );
    });

# Subscribing / unsubscribing

Subscribing:

    supervisor.subscribe( "gossiper_overlay_remote", ["member_in", "digestForwardableTest"] );

Unsubscribing:

    supervisor.unsubscribe( "gossiper_overlay_remote", ["member_in", "digestForwardableTest"] );

# Disconnecting from an overlay

    supervisor.disconnect( "gossiperl_overlay_remote" );

# Additional operations

## Checking current client state

    supervisor.getCurrentState( "gossiper_overlay_remote" );

## Get the list of current subscriptions

    supervisor.getSubscriptions( "gossiper_overlay_remote" );

## Sending arbitrary digests

    var digestData = [
      { name: 'property1', value: "Some string value", id: 0 },
      { name: 'property_bool', value: true, id: 1 },
      { name: 'and_an_i16', value: 123, id: 2, type_hint: 'i16' } ];

    supervisor.send( "gossiper_overlay_remote", digestData );

Thirft type is automatically read from the type of `value`. Numeric types will be sent as `i32` unless a type_hint is specified. Type hint can be used for the following types:

- `byte`
- `i16`
- `i32`
- `i64`
- `double`

## Reading custom digests

    var expectedDigestType = "...";
    var digestInfo = [
      { name: 'property1', value: "", id: 0 },
      { name: 'property_bool', value: false, id: 1 },
      { name: 'and_an_i16', value: 0, id: 2, type_hint: 'i16' } ];

    supervisor.read( expectedDigestType, binaryDigest, digestInfo );

`binaryDigest` is an envelope digest received as a forwarded message (forwarded event).

# Running tests

## Node.JS:

    nodeunit test/tests.node.js

## Browser

To run the tests for the browser please use the [Gossiperl Chrome client](https://github.com/gossiperl/gossiperl-client-chrome) project.
It's a Chrome extension launching into unit tests of the library.

Tests assume an overlay with the details specified in the test/...js files running.

# License

The MIT License (MIT)

Copyright (c) 2015 Radoslaw Gruchalski <radek@gruchalski.com>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.