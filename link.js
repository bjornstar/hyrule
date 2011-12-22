var	mongodb		= require('mongodb');
var	express		= require('express');

var serverHorcrux = new mongodb.Server('localhost', 27017);
var dbHyrule = new mongodb.Db('hyrule', serverHorcrux, {});

console.log('Hello Link, welcome to Hyrule.');
console.log(new Date());

var defaultPause = 50;

var zelda = express.createServer();
zelda.use(express.bodyParser());

dbHyrule.open(function() {});

zelda.get('/machines', function(req, res){
	dbHyrule.collection('machines', function(errCollection, collectionMachine, callback) {
		collectionMachine.find().toArray(  function(errFind, results) {
			var output = '';
			output += '<h1>Machines</h1>\r\n'; 
			for (result in results) {
				var mResult = results[result];
				output += mResult.mac + ' ' + mResult.timesseen + ' ' + mResult.lastseen + ' ' + mResult.jobs.length + ' <a href="http://horcrux:3000/client/' +mResult.mac + '/create">add a job</a><br />\r\n';
			}
			res.send(output);
		});
	});
});


zelda.get('/tasks', function(req, res){
	dbHyrule.collection('tasks', function(errCollection, collectionTasks, callback) {
		collectionTasks.find().toArray( function(errFind, results) {
			var output = '';
			output += '<h1>Tasks</h1>\r\n';
			for (result in results) {
				var tResult = results[result];
				output += tResult.machine + ' ' + tResult.started + ' ' + JSON.stringify(tResult.task) + ' ' + (tResult.completed - tResult.started) + '<br />\r\n';
			}
			res.send(output);
		});
	});
});

zelda.get('/jobs', function(req, res){
	dbHyrule.collection('jobs', function(errCollection, collectionJobs, callback) {
		collectionJobs.find().toArray( function(errFind, results) {
			var output = '';
			output += '<h1>Jobs</h1>\r\n';
			for (result in results) {
				var jResult = results[result];
				output += jResult.machine + ' ' + jResult.started + ' ' + (jResult.completed - jResult.started) + '<br />\r\n';
			}
			res.send(output);
		});
	});
});

zelda.get('*', function(req, res){
	res.send('<a href="/machines">/machines</a><br /><a href="/tasks">/tasks</a><br /><a href="/jobs">/jobs</a>');
});
zelda.listen(3001);

