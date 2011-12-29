var     mongodb         = require('mongodb');
var     express         = require('express');

var serverHorcrux = new mongodb.Server('localhost', 27017);
var dbHyrule = new mongodb.Db('hyrule', serverHorcrux, {});

console.log('Hello Ganon, welcome to Hyrule.');
console.log(new Date());

var ganon = express.createServer();
ganon.use(express.bodyParser());

var ganonTimer = 1000;

dbHyrule.open(function() {});

function ganonTime() {
	dbHyrule.collection('machines', function(eMachines, cMachines) {
		var now = new Date();
		cMachines.find({jobs:{'$elemMatch':{timeout:{'$lt':new Date()}}}}).toArray( function(fError, fResults) {
			if (fError) {
				console.log(fError);
			} else {
				if (fResults.length) {
					console.log(now + ' Job Timeout: ' + JSON.stringify(fResults));
				}
			}
		});
	});
	
	setTimeout(ganonTime, ganonTimer);
}

setTimeout(ganonTime, ganonTimer);

ganon.listen(3002);
