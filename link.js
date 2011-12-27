var	mongodb		= require('mongodb');
var	express		= require('express');

var serverHorcrux = new mongodb.Server('localhost', 27017);
var dbHyrule = new mongodb.Db('hyrule', serverHorcrux, {});

console.log('Hello Link, welcome to Hyrule.');
console.log(new Date());

var defaultPause = 50;

var link = express.createServer();
link.use(express.bodyParser());

dbHyrule.open(function() {});

link.get('/machines', function(req, res){
	dbHyrule.collection('machines', function(errCollection, collectionMachine, callback) {
		collectionMachine.find().sort({lastseen:-1}).toArray( function(errFind, results) {
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

link.get('/job/:jobid/reset', function(req, res) {
	res.send('nice.');
});

link.get('/inprogress', function(req, res){
	dbHyrule.collection('machines', function(errCollection, collectionMachine, callback) {
		collectionMachine.find({jobs:{'$elemMatch':{started:{'$ne':null}}}}).sort({lastseen:-1}).toArray( function(errFind, results) {
			var output = '';
			output += '<h1>In Progress</h1>\r\n';
			for (result in results) {
				var mResult = results[result];
				output += mResult.mac + ' ';
				for (job in mResult.jobs) {
					var jResult = mResult.jobs[job];
					output += 'Job: ';
					output += jResult.started;
					output += ' <a href="/job/' + jResult._id + '/reset">reset</a>';
					output += '<br />\r\n';
					for (task in jResult.tasks) {
						var tResult = jResult.tasks[task];
						output += 'Task: ';
						output += JSON.stringify(tResult.task) + ' ';
						output += tResult.started + '<br />\r\n';
					}
				}
				output += '<br />\r\n';
			}
			res.send(output);
		});
	});
});

link.get('/tasks', function(req, res){
	dbHyrule.collection('tasks', function(errCollection, collectionTasks, callback) {
		collectionTasks.find().sort({started:-1}).toArray( function(errFind, results) {
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

link.get('/jobs', function(req, res){
	dbHyrule.collection('jobs', function(errCollection, collectionJobs, callback) {
		collectionJobs.find().sort({started:-1}).toArray( function(errFind, results) {
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

link.get('*', function(req, res){
	var output = '';
	output += '<a href="/inprogress">/inprogress</a><br />';
	output += '<a href="/machines">/machines</a><br />';
	output += '<a href="/tasks">/tasks</a><br />';
	output += '<a href="/jobs">/jobs</a>';
	res.send(output);
});

link.listen(3001);

