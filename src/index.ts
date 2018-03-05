
import * as http from "http"
import * as https from "https"
import * as fs from 'fs'
import * as mg from "mongodb"


let atlasConnectionUri : string
let cachedDb  : mg.Db    = null
let exchanges : string[] = null

// setup event handler for lambda function
exports.handler = (event: any, context: any, callback: any) => {
    var uri       = process.env['MONGODB_ATLAS_CLUSTER_URI'];
    var exchangesData : string = process.env['SUPPORTED_CRYPTO_EXCHANGES']
    
    if (atlasConnectionUri != null && exchanges != null) {
        fetchTickers(context, callback)
    } 
    else {
        atlasConnectionUri = uri;
        exchanges = exchangesData.split(",")
        fetchTickers(context, callback)
    } 
};

// donwnload ticker from source api
function fetchTickers(context: any, callback: any) {
  for (var exchange of exchanges) {
      let url = `https://vip.bitcoin.co.id/api/${exchange}/ticker`
      console.log(`Fetching ticker for ${exchange}`);
      https.request(url, function(res) {
        console.log(`=> received ticker data`);
        res.setEncoding('utf8');
        res.on('data', function (data) {
          let object = JSON.parse(data.toString())
          let json   = object["ticker"]
          json["source"]   = "bitcoin.id"
          json["exchange"] = exchange
          //the following line is critical for performance reasons to allow re-use of database connections across calls to this Lambda function and avoid closing the database connection. The first call to this lambda function takes about 5 seconds to complete, while subsequent, close calls will only take a few hundred milliseconds.
          context.callbackWaitsForEmptyEventLoop = false;
          writeTicker(json, exchange, callback)
        });
      }).end();
  }
}


function writeTicker(json: object, exchange: string, callback: any) {
    let collectionName = "cryptocurrency"
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

function insertTickerData(db: mg.Db, json: object, callback: any) {
  db.collection('ticker').insertOne( json, function(err, result) {
      if(err!=null) {
          console.error("an error occurred while inserting ticker", err);
          callback(null, JSON.stringify(err));
      }
      else {
        console.log("=> inserted ticker with id: " + result.insertedId);
        callback(null, "SUCCESS");
      }
      //we don't need to close the connection thanks to context.callbackWaitsForEmptyEventLoop = false (above)
      //this will let our function re-use the connection on the next called (if it can re-use the same Lambda container)
      //db.close();
  });
};

// consts url

// // const tickerFilePath : string = `../data/ticker_${exchange}.txt`
// const mongoUrl       : string = `mongodb://localhost:27017/`

// // setup timer
// var minutes = 0.1, the_interval = minutes * 60 * 1000;

// // run timer
// fetchTicker(exchange, mongoUrl)
// setInterval(function() {
//   fetchTicker(exchange, mongoUrl)
// }, the_interval);

// function fetchTicker(exchange: string, mongoUrl: string) {
//   let url = `https://vip.bitcoin.co.id/api/${exchange}/ticker`
//   console.log(url);
//   https.request(url, function(res) {
//    console.log(`Downloaded ticker for ${exchange}`);
//     res.setEncoding('utf8');
//     res.on('data', function (data) {
//       let object = JSON.parse(data.toString())
//       writeTicker(object, mongoUrl)
//     });
//   }).end();
// }

// function writeTicker(data: object, mongoUrl: string) {
//   let dbName = `bitcoinid`
//   let collectionName = `ticker`
//   mg.MongoClient.connect(mongoUrl, function(err, db) {
//   if (err) throw err;
//   var dbo = db.db(dbName);
//   dbo.collection(collectionName).insertOne(data, function(err, res) {
//     if (err) throw err;
//     console.log("Ticker saved to MongoDb");
//     db.close();
//   });
// });
// }

// http.createServer(function (req, res) {
//   if (req.url == '/fileupload') {
//     var form = new formidable.IncomingForm();
//     form.parse(req, function (err, fields, files) {
//       var oldpath = files.filetoupload.path;
//       var newpath = '/Users/nakama/Desktop/Personal/bitcoin.co.id/uploadedFiles/' + files.filetoupload.name;
//       fs.rename(oldpath, newpath, function (err) {
//         if (err) throw err;
//         res.write('File uploaded and moved!');
//         res.end();
//       });
//  });
//   } else {
//     res.writeHead(200, {'Content-Type': 'text/html'});
//     res.write('<form action="fileupload" method="post" enctype="multipart/form-data">');
//     res.write('<input type="file" name="filetoupload"><br>');
//     res.write('<input type="submit">');
//     res.write('</form>');
//     return res.end();
//   }
// }).listen(8080);
