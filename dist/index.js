"use strict";
exports.__esModule = true;
var https = require("https");
var mg = require("mongodb");
var atlasConnectionUri;
var cachedDb = null;
var exchanges = null;
exports.handler = function (event, context, callback) {
    var uri = process.env['MONGODB_ATLAS_CLUSTER_URI'];
    var exchangesData = process.env['SUPPORTED_CRYPTO_EXCHANGES'];
    if (atlasConnectionUri != null && exchanges != null) {
        fetchTickers(context, callback);
    }
    else {
        atlasConnectionUri = uri;
        exchanges = exchangesData.split(",");
        fetchTickers(context, callback);
    }
};
function fetchTickers(context, callback) {
    for (var _i = 0, exchanges_1 = exchanges; _i < exchanges_1.length; _i++) {
        var exchange = exchanges_1[_i];
        var url = "https://vip.bitcoin.co.id/api/" + exchange + "/ticker";
        console.log("Fetching ticker for " + exchange);
        https.request(url, function (res) {
            console.log("=> received ticker data");
            res.setEncoding('utf8');
            res.on('data', function (data) {
                var object = JSON.parse(data.toString());
                var json = object["ticker"];
                json["source"] = "bitcoin.id";
                json["exchange"] = exchange;
                context.callbackWaitsForEmptyEventLoop = false;
                writeTicker(json, exchange, callback);
            });
        }).end();
    }
}
function writeTicker(json, exchange, callback) {
    var collectionName = "cryptocurrency";
    try {
        if (cachedDb == null) {
            console.log('=> connecting to database');
            mg.MongoClient.connect(atlasConnectionUri, function (err, db) {
                console.log('=> connected to database');
                cachedDb = db.db(collectionName);
                return insertTickerData(cachedDb, json, callback);
            });
        }
        else {
            console.log('=> connected to cached database');
            insertTickerData(cachedDb, json, callback);
        }
    }
    catch (err) {
        console.error('an error occurred while connecting to mongo atlas', err);
    }
}
function insertTickerData(db, json, callback) {
    db.collection('ticker').insertOne(json, function (err, result) {
        if (err != null) {
            console.error("an error occurred while inserting ticker", err);
            callback(null, JSON.stringify(err));
        }
        else {
            console.log("=> inserted ticker with id: " + result.insertedId);
            callback(null, "SUCCESS");
        }
    });
}
;
