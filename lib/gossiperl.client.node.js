var vm = require("vm");
var fs = require('fs');
var path = require('path');
var _ = require('underscore');
var Thrift = require("thrift");
var CryptoJS = require("crypto-js");
var atob = require("atob");
var btoa = require("btoa");
Thrift.Type = Thrift.Thrift.Type;
// Read and eval library
eval(fs.readFileSync(path.resolve(__dirname, 'transport/nodejs/transport.js'),'utf8'));
eval(fs.readFileSync(path.resolve(__dirname, 'gossiperl.client.js'),'utf8'));
eval(fs.readFileSync(path.resolve(__dirname, 'gossiperl_types.js'),'utf8'));
Gossiperl.CurrentContext = Gossiperl.Context.NODEJS;
exports.Gossiperl = Gossiperl;
