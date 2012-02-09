var mongodb = require('mongodb');
var util    = require('util');

var ObjectID = mongodb.ObjectID;

var serverHyrule = new mongodb.Server('localhost', 27017);
var dbHyrule = new mongodb.Db('hyrule', serverHyrule, {});
var cMachines = new mongodb.Collection(dbHyrule, 'machines');

var hyrule = new Object();
hyrule.appName = 'Ganon';
hyrule.appStart = new Date();

function log(data) {
  console.log("["+new Date().toISOString()+"] "+hyrule.appName+"."+process.pid+": "+util.inspect(data));
}

dbHyrule.open(function() {
        log('Welcome to Hyrule.');
        var timeDBOpen = new Date();
        log('It took ' + (timeDBOpen.getTime() - hyrule.appStart.getTime()) + 'ms for ' + hyrule.appName + ' to connect to the database.');
});


var ganonTimer = 1000;

function ganonTime() {
	var now = new Date();
	cMachines.find({$or:[{'jobs.tasks.timeout':{$lt:new Date()}},{'jobs.timeout':{$lt:new Date()}}]}).toArray( function(fError, fResults) {
		if (fError) {
			console.log(fError);
		} else {
			if (fResults.length) {
				failTask(fResults);
			}
		}
	});
}

function failTask(machine) {
	var taskDone = new Object()
	taskDone = machine.jobs;
	dbHyrule.collection('tasks', function(eTasks, cTasks) {

	});
}		

function idleTimeout() {
  var now = new Date();
  var aminuteago = new Date(now.getTime()-10*1000);

  var findObject = new Object();
  findObject.alive = true;
  findObject.lastseen = new Object();
  findObject.lastseen['$lt'] = aminuteago;

  var setObject = {'$set':{alive:false}};

  cMachines.update(findObject, setObject, {safe:true, multi:true, upsert:false}, function () {
    var end = new Date();
    log(end.getTime()-now.getTime());
  });
}

setInterval(idleTimeout, ganonTimer);
//setInterval(ganonTime, ganonTimer);
