var     mongodb         = require('mongodb');

var ObjectID = mongodb.BSONPure.ObjectID;

var serverHorcrux = new mongodb.Server('localhost', 27017);
var dbHyrule = new mongodb.Db('hyrule', serverHorcrux, {});

var timeBoot = new Date();

var appName = 'Ganon';

dbHyrule.open(function() {
        console.log('Welcome to Hyrule.');
        var timeDBOpen = new Date();
        console.log('It took ' + (timeDBOpen.getTime() - timeBoot.getTime()) + 'ms for ' + appName + ' to connect to the database.');
});

console.log('Hello, my name is ' + appName + '!');

var ganonTimer = 1000;

function ganonTime() {
	dbHyrule.collection('machines', function(eMachines, cMachines) {
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
	});
}

function failTask(machine) {
	var taskDone = new Object()
	taskDone = machine.jobs;
	dbHyrule.collection('tasks', function(eTasks, cTasks) {
		console.log('A job or task timed out.');
	});
}		

setInterval(ganonTime, ganonTimer);
