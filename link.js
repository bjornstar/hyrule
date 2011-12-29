var	mongodb		= require('mongodb');
var	express		= require('express');

var serverHorcrux = new mongodb.Server('localhost', 27017);
var dbHyrule = new mongodb.Db('hyrule', serverHorcrux, {});

console.log('Hello Link, welcome to Hyrule.');
console.log(new Date());

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
				output += '<a href="/machine/' + mResult.mac + '">' + mResult.mac + '</a>';
				output += ' ' + mResult.timesseen + ' ' + mResult.lastseen + ' ' + mResult.jobs.length + ' <a href="/machine/' +mResult._id + '/createjob">add a job</a><br />\r\n';
			}
			res.send(output);
		});
	});
});

link.get('/job/:jobid([0-9a-fA-F]{24})/retry', function(req, res) {
	var jObjectID = new dbHyrule.bson_serializer.ObjectID(req.params.jobid);
	dbHyrule.collection('machines', function(eCollection, cMachines) {
		cMachines.findAndModify(
				{jobs:{'$elemMatch':{_id:jObjectID}}},
				[],
				{'$unset' : {'jobs.$.started':1,'jobs.$.timeout':1}, '$set':{'jobs.$.locked':true}}, //we lock this so clients don't get this while we're updating.
				function (eUpdate, rUpdate) {
					var jUpdate;
					for (job in rUpdate.jobs){
						if (rUpdate.jobs[job]._id == req.params.jobid) {
							jUpdate = rUpdate.jobs[job];
						}
					}
					for (task in jUpdate.tasks) {
						delete jUpdate.tasks[task].started;
						delete jUpdate.tasks[task].timeout;
					}
					console.log(JSON.stringify(jUpdate));
					cMachines.update({jobs:{'$elemMatch':{_id:jObjectID}}}, {'$set':{'jobs.$.tasks':jUpdate.tasks}, '$unset':{'jobs.$.locked':1}}, function(eee, rrr) {
						res.send('ok');
					});
		});
	});
});

link.get('/machine/:machine([0-9a-fA-F]{12}|[0-9a-fA-F]{24})', function(req, res) {
	var findObject;
	if (req.params.machine.length==12) {
		findObject = {mac:req.params.machine};
	} else if (req.params.machine.length==24) {
		var mObjectID = new dbHyrule.bson_serializer.ObjectID(req.params.machine);
		findObject = {_id:mObjectID};
	}
	dbHyrule.collection('machines', function(cError, cMachines) {
		cMachines.findOne(findObject, function(fError, fResult) {
			res.send(fResult);
		});
	});
});

link.get('/machine/:machine([0-9a-fA-F]{12}|[0-9a-fA-F]{24})/createjob', function(req, res) {
	dbHyrule.collection('machines', function(cError, cMachines) {
		var findObject;
		if (req.params.machine.length==12) {
			findObject = {mac:req.params.machine};
		} else if (req.params.machine.length==24) {
			var mObjectID = new dbHyrule.bson_serializer.ObjectID(req.params.machine);
			findObject = {_id:mObjectID};
		}
		cMachines.findOne(findObject, function(fError, fResult) {
			if(fResult) {
                		fResult.jobs.push({_id: new dbHyrule.bson_serializer.ObjectID(), created: new Date(), tasks: new Array(), duration:110000});
                		for(var n=1;n<=10;n++) {
		                        fResult.jobs[fResult.jobs.length-1].tasks.push(
                		                {task:{execpass:'ping -n '+n+' horcrux'}, _id: new dbHyrule.bson_serializer.ObjectID(), created: new Date(), duration: n*2000}
		                        );
		                }
                		cMachines.save(fResult, {'safe':true}, function(err,callback){
		                        if(err && !err.ok) {
                		                res.send('failed to create.\n');
		                        } else {
                		                res.send('ok\n');
		                        }
                		});
			} else {
				res.send('failed to find machine.\n');
			}
		});
	});
});

link.get('/job/:jobid([0-9a-fA-F]{24})', function(req, res) {
	var jObjectID = new dbHyrule.bson_serializer.ObjectID(req.params.jobid);
	dbHyrule.collection('jobs', function(cError, cJobs) {
		cJobs.findOne({_id:jObjectID}, function(fError, fResult) {
			res.send(fResult);
		});
	});
});

link.get('/task/:taskid([0-9a-fA-F]{24})', function(req, res) {
	var tObjectID = new dbHyrule.bson_serializer.ObjectID(req.params.taskid);
	dbHyrule.collection('tasks', function(cError, cTasks) {
		cTasks.findOne({_id:tObjectID}, function(fError, fResult) {
			res.send(fResult);
		});
	});
});

link.get('/inprogress', function(req, res){
	dbHyrule.collection('machines', function(cError, cMachines, callback) {
		cMachines.find({jobs:{'$elemMatch':{started:{'$ne':null}}}}).sort({lastseen:-1}).toArray( function(errFind, results) {
			var output = '';
			output += '<h1>In Progress</h1>\r\n';
			for (result in results) {
				var mResult = results[result];
				output += mResult.mac + ' ';
				for (job in mResult.jobs) {
					var jResult = mResult.jobs[job];
					if (jResult.started) {
						output += 'Job: ';
						output += jResult.started;
						output += ' <a href="/job/' + jResult._id + '/retry">retry</a>';
						output += '<br />\r\n';
						for (task in jResult.tasks) {
							var tResult = jResult.tasks[task];
							if (tResult.started) {
								output += 'Task: ';
								output += JSON.stringify(tResult.task) + ' ';
								output += tResult.started + '<br />\r\n';
							}
						}
					}
				}
				output += '<br />\r\n';
			}
			res.send(output);
		});
	});
});

link.get('/tasks', function(req, res){
	dbHyrule.collection('tasks', function(cError, cTasks, callback) {
		cTasks.find().sort({started:-1}).toArray( function(errFind, results) {
			var output = '';
			output += '<h1>Tasks</h1>\r\n';
			for (result in results) {
				var tResult = results[result];
				output += '<a href="/task/' + tResult._id + '">' + tResult._id + '</a>';
				output += ' ' + tResult.machine + ' ' + tResult.started + ' ' + JSON.stringify(tResult.task) + ' ' + (tResult.completed - tResult.started) + '<br />\r\n';
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
				output += '<a href="/job/' + jResult._id + '">' + jResult._id + '</a>';
				output += ' ' + jResult.machine + ' ' + jResult.started + ' ' + (jResult.completed - jResult.started) + '<br />\r\n';
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

