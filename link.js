var	mongodb		= require('mongodb');
var	express		= require('express');
var	io		= require('socket.io');

var ObjectID = mongodb.ObjectID;

var serverHorcrux = new mongodb.Server('localhost', 27017);
var dbHyrule = new mongodb.Db('hyrule', serverHorcrux, {});

var timeBoot = new Date();

var appName = 'Link';

dbHyrule.open(function() {
        console.log('Welcome to Hyrule.');
        var timeDBOpen = new Date();
        console.log('It took ' + (timeDBOpen.getTime() - timeBoot.getTime()) + 'ms for ' + appName + ' to connect to the database.');
});

console.log('Hello, my name is ' + appName + '!');

var link = express.createServer();
io = io.listen(link);

var socketCollection = new Object();
socketCollection.size = 0;
socketCollection.frequency = 100;

io.sockets.on('connection', function (socket) {
	socketCollection.size += 1;
	socket.on('disconnect', function() {
		console.log(socketCollection);
		if (socketCollection[socket.id]) {
			clearInterval(socketCollection[socket.id].socketInterval);
		}
		delete socketCollection[socket.id];
		socketCollection.size -= 1;
		console.log('Client disconnected.');
	});
	socket.on('dashstart', function (data) {
		socketCollection[socket.id] = {'prevTimesseen':0};
		socketCollection[socket.id].socketInterval = setInterval( function() {
			if (socketCollection[socket.id]) {
				dbHyrule.collection('machines', function(errCollection, collectionMachine) {
       				        collectionMachine.find({},{timesseen:1}).sort({_id:1}).toArray( function(errFind, rMachines) {
						var output;
						var totalTimesseen = 0;
						for (rMachine in rMachines) {
							var cMachine = rMachines[rMachine];
							totalTimesseen += cMachine.timesseen;
						}
						var output = new Object();
						output.simultaneousUsers = socketCollection.size;
						output.dashFrequency = socketCollection.frequency;
						output.totalUpdatecount = totalTimesseen;
						output.deltaUpdatecount = totalTimesseen - socketCollection[socket.id].prevTimesseen;
						output.perclientTime = Math.floor(output.dashFrequency / output.deltaUpdatecount);
						socket.emit('dash', output);
						socketCollection[socket.id].prevTimesseen = totalTimesseen;
					});
				});
			}
		}, socketCollection.frequency);
	});
	socket.on('rdmsrstart', function (data) {
		socketCollection[socket.id] = {'prevData':0};
		socketCollection[socket.id].socketInterval = setInterval( function() {
			if (socketCollection[socket.id]) {
				dbHyrule.collection('tasks', function(errCollection, collectionTasks) {
					collectionTasks.find({'task.rdmsr':{'$ne':null}}).sort({completed:-1}).limit(3).toArray( function(errFind, rTasks) { // index on completed.
						if (socketCollection[socket.id]) {
							var output = '';
							for (task in rTasks) {
								output += JSON.stringify(rTasks[task]) + ' ';
							}
							if (socketCollection[socket.id].prevData!=output) {
								socket.emit('rdmsr', output);
							}
							socketCollection[socket.id].prevData = output;
						}
					});
				});
			}
		}, socketCollection.frequency);
		createRdmsrPollingJob(data);
	});
});

link.get('/machines', function(req, res){
	dbHyrule.collection('machines', function(errCollection, collectionMachine, callback) {
		collectionMachine.find().sort({_id:-1}).toArray( function(errFind, results) {
			var output = '';
			output += '<script src="http://code.jquery.com/jquery-1.7.1.min.js"></script>\r\n';
			output += '<script src="/socket.io/socket.io.js"></script>\r\n';
			output += '<script type="text/javascript">\r\n';
			output += 'var socket = io.connect();\r\n';
			output += 'socket.emit(\'dashstart\');\r\n';
			output += 'socket.on(\'dash\', function (data) {\r\n';
			output += '$(\'#banana\').html(\'<p>\'+JSON.stringify(data)+\'</p>\\r\\n\');\r\n';
			output += '});\r\n';
			output += '</script>\r\n';
			output += '<h1>Machines</h1>\r\n'; 
			output += '<div id="banana"> </div>\r\n';
			for (result in results) {
				var mResult = results[result];
				output += '<a href="/machine/' + mResult._id + '">' + mResult._id + '</a>';
				if (mResult.mac) {
					output += ' ' + mResult.mac;
				}
				output += ' ' + mResult.timesseen;
				output += ' ' + mResult.lastseen;
				output += ' ' + mResult.jobs.length;
				output += ' <a href="/machine/' +mResult._id + '/createjob">add a job</a>';
				output += '<br />\r\n';
			}
			res.send(output);
		});
	});
});

link.get('/job/:jobid([0-9a-fA-F]{24})/retry', function(req, res) {
	var jObjectID = new ObjectID(req.params.jobid);
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
		var mObjectID = new ObjectID(req.params.machine);
		findObject = {_id:mObjectID};
	}
	dbHyrule.collection('machines', function(cError, cMachines) {
		cMachines.findOne(findObject, function(fError, fResult) {
			res.send(fResult);
		});
	});
});

link.get('/machine/:machine([0-9a-fA-F]{12}|[0-9a-fA-F]{24})/jobs', function(req, res) {
        dbHyrule.collection('machines', function(cError, cMachines) {
                var findObject;
                if (req.params.machine.length==12) {
                        findObject = {mac:req.params.machine};
                } else if (req.params.machine.length==24) {
                        var mObjectID = new ObjectID(req.params.machine);
                        findObject = {_id:mObjectID};
                }
                cMachines.findOne(findObject, {jobs:1}, function(fError, fResult) {
                        if(fResult) {
				res.send(fResult);
			} else {
                                res.send('failed to find machine.\n');
                        }
                });
        });
});

function removeRdmsrPollingJob(rdmsrObject) {

}

function createRdmsrPollingJob(rdmsrObject) {
	dbHyrule.collection('machines', function(cError, cMachines) {
		for (machine in rdmsrObject.machines) {

			var findObject;

			if (machine.length==12) {
				findObject = {mac:machine};
			} else if (machine.length==24) {
				var mObjectID = new ObjectID(machine);
				findObject = {_id:mObjectID};
			}

			var jPoll = new Object();
			jPoll._id = new ObjectID();
			jPoll.created = new Date();
			jPoll.tasks = new Array();
			jPoll.duration = 10000;
			jPoll.poll = 100;

			for(msr in rdmsrObject.machines[machine].msrs) {
				var tPoll = new Object();
				tPoll._id = new ObjectID();
				tPoll.created = new Date();
				tPoll.duration = 1000;
				tPoll.poll = 100;
				tPoll.task = new Object();
				tPoll.task.rdmsr = new Object();
				tPoll.task.rdmsr[msr] = rdmsrObject.machines[machine].msrs[msr];
				jPoll.tasks.push(tPoll);
			}

			cMachines.findAndModify( // we use findAndModify because of its atomic operation, otherwise we could lose data.
			findObject,
			[],
			{'$push':{'jobs':jPoll}},
			{new:true},
			function(fError, fResult) {
				//console.log(fResult);
			});
		}
	});
}

link.get('/machine/:machine([0-9a-fA-F]{12}|[0-9a-fA-F]{24})/rdmsr/:msr([0-9a-fA-F]+)/:affinity([0-9a-fA-F]+)?', function(req, res, next) {
	if (req.params.msr.length>4) {
		next();
	}

	var output = '';
	output += '<script src="http://code.jquery.com/jquery-1.7.1.min.js"></script>\r\n';
	output += '<script src="/socket.io/socket.io.js"></script>\r\n';
	output += '<script type="text/javascript">\r\n';
	output += 'var socket = io.connect();\r\n';
	output += 'var hope;\r\n';

	var mTest = new Array();
	mTest = [req.params.machine];

	var MSRs = new Object();
	MSRs.machines = new Object();
	for (m in mTest) {
		mT = mTest[m];
		MSRs.machines[mT] = new Object();
		MSRs.machines[mT].msrs = new Object();
		MSRs.machines[mT].msrs[req.params.msr] = req.params.affinity;
		for (var jj=0;jj<=100;jj++) {
			MSRs.machines[mT].msrs[jj] = jj;
		}
	}
	output += 'socket.emit(\'rdmsrstart\', ' + JSON.stringify(MSRs) + ');\r\n';
	output += 'socket.on(\'rdmsr\', function (data) {\r\n';
	output += 'hope = data;\r\n';
	output += '$(\'#banana\').html(\'<p>\'+JSON.stringify(data)+\'</p>\\r\\n\');\r\n';
	output += '});\r\n';
	output += '</script>\r\n';
	output += '<h1>rdmsr ' + req.params.msr + '</h1>\r\n';
	output += '<div id="banana"> </div>\r\n';

	res.send(output);
});

link.get('/machine/:machine([0-9a-fA-F]{12}|[0-9a-fA-F]{24})/createjob', function(req, res) {
	dbHyrule.collection('machines', function(cError, cMachines) {
		var findObject;
		if (req.params.machine.length==12) {
			findObject = {mac:req.params.machine};
		} else if (req.params.machine.length==24) {
			var mObjectID = new ObjectID(req.params.machine);
			findObject = {_id:mObjectID};
		}
		cMachines.findOne(findObject, function(fError, fResult) {
			if(fResult) {
				var jPoll = new Object();
				jPoll._id = new ObjectID();
				jPoll.created = new Date();
				jPoll.tasks = new Array();
				jPoll.duration = 110000;
                		fResult.jobs.push(jPoll);
                		for(var n=1;n<=10;n++) {
					var tPoll = new Object();
					tPoll._id = new ObjectID();
					tPoll.created = new Date();
					tPoll.duration = 2000;
					tPoll.task = {execpass:'c:\\rdmsr.exe 1486 0'};
		                        fResult.jobs[fResult.jobs.length-1].tasks.push(tPoll);
		                }
				cMachines.save(fResult, {}, function(err,callback){ // this is dangerous, we could lose data.
		                        if(err && !err.ok) {
                		                res.send('failed to create.\n');
		                        } else {
                		                res.send(JSON.stringify(jPoll));
		                        }
                		});
			} else {
				res.send('failed to find machine.\n');
			}
		});
	});
});

link.get('/job/:jobid([0-9a-fA-F]{24})', function(req, res) {
	var jObjectID = new ObjectID(req.params.jobid);
	dbHyrule.collection('jobs', function(cError, cJobs) {
		cJobs.findOne({_id:jObjectID}, function(fError, fResult) {
			res.send(fResult);
		});
	});
});

link.get('/task/:taskid([0-9a-fA-F]{24})', function(req, res) {
	var tObjectID = new ObjectID(req.params.taskid);
	dbHyrule.collection('tasks', function(cError, cTasks) {
		cTasks.findOne({_id:tObjectID}, function(fError, fResult) {
			res.send(fResult);
		});
	});
});

link.get('/inprogress', function(req, res){
	dbHyrule.collection('machines', function(cError, cMachines, callback) {
		cMachines.find({'$or':[{'jobs.started':{'$ne':null}},{'jobs.tasks.started':{'$ne':null}}]}).sort({lastseen:-1}).toArray( function(errFind, results) {
			var output = '';
			output += '<h1>In Progress</h1>\r\n';
			for (result in results) {
				var mResult = results[result];
				output += mResult.mac + ' ';
				for (job in mResult.jobs) {
					var jResult = mResult.jobs[job];
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
				output += '<br />\r\n';
			}
			res.send(output);
		});
	});
});

link.get('/tasks', function(req, res){
	dbHyrule.collection('tasks', function(cError, cTasks, callback) {
		cTasks.find().sort({started:-1}).limit(50).toArray( function(errFind, results) {
			var output = '';
			output += '<h1>Last 50 Tasks</h1>\r\n';
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
	output += '<a href="/jobs">/jobs</a><br />';
	output += '<a href="/machine/4f0a3c39856936725a000001/rdmsr/198/ff">rdmsr</a>';
	res.send(output);
});

link.get('/version', function(req,res) {
        fs.readFile('package.json', 'utf8', function(err,data) {
                if (err) throw err;
                var jsonPackage = JSON.parse(data);
                link.version = jsonPackage.version;
                res.send(link.version);
        });
});

link.listen(3001);

