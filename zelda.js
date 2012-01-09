var	mongodb		= require('mongodb');
var	express		= require('express');
var	fs		= require('fs');

var ObjectID = mongodb.ObjectID;

var serverHorcrux = new mongodb.Server('localhost', 27017);
var dbHyrule = new mongodb.Db('hyrule', serverHorcrux, {});

var timeBoot = new Date();

var appName = 'Zelda';

dbHyrule.open(function() {
	console.log('Welcome to Hyrule.');
	var timeDBOpen = new Date();
	console.log('It took ' + (timeDBOpen.getTime() - timeBoot.getTime()) + 'ms for ' + appName + ' to connect to the database.');
});

console.log('Hello, my name is ' + appName + '!');

var defaultPause = 10;

var zelda = express.createServer();

function Client(mac) {
	var self = this; //You have to do this so you can reference these things later.
	var machine;
	var start = new Date();

	this.mac = mac.toLowerCase();
	var findObject = new Object();

	if (self.mac.length==12) {
		self.findObject = {mac:self.mac};
	} else if (self.mac.length==24) {
		self.findObject = {_id:new ObjectID(self.mac)};
	}

	this.taskOut = {task:{pause:defaultPause}}; //,_id:new ObjectID(),created:new Date()}; // This is the default task.

	this.appendError = function(errorObject) {
		console.log(errorObject);
		if (!self.taskOut.errors||self.taskOut.errors.length==0) {
			self.taskOut.errors = new Array();
		}
		self.taskOut.errors.push({'error':errorObject,_id:new ObjectID(),'created':new Date()});
	}

	function getMachines(errCollection, collectionMachine, callback) {
		if (errCollection!=null) {
			self.appendError({'errordata':errCollection,'errorin':'hyrule.collection(\'machines\')'});
			self.res.json(self.taskOut);
		} else {
			collectionMachine.findAndModify(
			self.findObject,
			[],
			{'$set':{'lastseen':new Date(),'alive':true}, '$inc':{'timesseen':1}},
			{'new':true, 'upsert':true, 'fields': {'jobs':{'$slice':5},'jobs.tasks':{'$slice':5},'created':1}},
			function(famErr, famMachine) {
				if (famErr && !famErr.ok) {
					self.appendError({'errordata':famErr,'errorin':'collectionMachine.findAndModify'});
					self.res.json(self.taskOut);
				} else {
					if (famMachine!=null) {
						self.machine = famMachine;
						if (!self.machine.created || !self.machine.jobs) {
							if (!self.machine.created) {
								self.machine.created = new Date();
							}
							if (!self.machine.jobs) {
								self.machine.jobs = new Array();
							}
							collectionMachine.update(self.findObject,{'$set':{'created':new Date(),'jobs':new Array()}},function() {});
						}

// Every request from the client, we need to do up to here. ^^^^^^^^^^^^^

	self.doyourthang(collectionMachine);

// And after here. vvvvvvvvvvv

					} else {
						self.appendError({'errordata':famErr,'errorin':'collectionMachine.findAndModify:no results'});
						self.res.json(self.taskOut);
						delete inProgress[self.req.params.mac];
					}
				}
			});
		}
	}

	function taskThang(cMachine) {
		var tStart = self.taskOut;// Our default task.
		var jCount = 0;// This is kind of like our process count.
		var tCount = 0;// This is kind of like our thread count.

		var updateObject = new Object();
		updateObject['$set'] = new Object();

		var uO = updateObject['$set'];// Makes referring to updateObject easier.

		for (job in self.machine.jobs) {
			if (self.machine.jobs[job].locked) {
				break;
			}

			if (self.machine.jobs[job].started) {
				jCount +=1; 
			}

			if (jCount>=2) {
				break;
			}

			var jStart = self.machine.jobs[job];

			if (!jStart.started && jCount<1) {
				var jStarted = new Date()
				var jTimeout = new Date(jStarted.getTime() + jStart.duration);
				jStart.started = jStarted;
				jStart.timeout = jTimeout;

				uO['jobs.'+job+'.started'] = jStarted;
				uO['jobs.'+job+'.timeout'] = jTimeout;

				jCount +=1
			}

			for (task in jStart.tasks) {
				if (jStart.tasks[task].started) {
					tCount +=1 
					break;
				}

				if (tCount>=1) {
					break;
				}

				tStart = jStart.tasks[task];

				tStarted = new Date();
				tTimeout = new Date(tStarted.getTime() + tStart.duration);
				tStart.started = tStarted;
				tStart.timeout = tTimeout;

				uO['jobs.'+job+'.tasks.'+task+'.started'] = tStarted;
				uO['jobs.'+job+'.tasks.'+task+'.timeout'] = tTimeout;

				tCount +=1
			}
		}

		if (tStart != self.taskOut) {
			cMachine.update(self.findObject,updateObject,function(errSave) { // Yay for atomic operations.
				if (errSave) {
					console.log('errored: ' + JSON.stringify(tStart) + ' ' + new Date());
				} else {
				//	console.log('updated: ' + JSON.stringify(tStart) + ' ' + self.start.getTime() + ' ' + now.getTime());
				}
			});
		}

		self.res.json(tStart); // We're not waiting for the save event to finish.
		delete inProgress[self.req.params.mac];

		self.end = new Date();
//		console.log(self.end - self.start);
	}

	function passThang(collectionMachine) {
		var jPass;
		var tRemove = -1;

		var updateObject = new Object();
		updateObject['$pull'] = new Object();

		var uO = updateObject['$pull'];

		for (job in self.machine.jobs) {
			if (!self.machine.jobs[job].started) { // Dont' bother looking if it hasn't started.
				break;
			}

			if (self.machine.jobs[job].locked) { // Don't bother looking if it's locked.
				break;
			}

			jPass = self.machine.jobs[job];
			jRemove = job;

			for (task in jPass.tasks) {
				if (self.taskID != jPass.tasks[task]._id) {
					continue;
				}

				if (!jPass.tasks[task].started) {
var now = new Date();
console.log('NOT STARTED!!!! ' + JSON.stringify(jPass.tasks[task]) + ' ' + self.start.getTime() + ' ' + now.getTime());
					break;
				}

				var tLog = jPass.tasks[task];
				tLog.machine = self.machine._id;
				tLog.job = jPass._id;
				tLog.completed = new Date();

				dbHyrule.collection('tasks', function(err, collectionTask) {
					collectionTask.insert(tLog);
				});

				uO['jobs.'+job+'.tasks'] = new Object();
				uO['jobs.'+job+'.tasks']._id = new ObjectID(tLog._id);

				tRemove = task;
			}
		}

		if (tRemove == -1) {
			return;
		}

		jPass.tasks.splice(tRemove,1);

		if (jPass.tasks.length==0) {
			var jLog = self.machine.jobs.splice(jRemove,1);
			jLog.machine = self.machine._id;
			jLog.completed = new Date();
			delete jLog.tasks;
			dbHyrule.collection('jobs', function(err, collectionJob) {
				collectionJob.insert(jLog);
			});

			uO['jobs'] = new Object();
			uO['jobs']._id = new ObjectID(jLog._id);
		}

		collectionMachine.update(self.findObject, updateObject, function(err,callback){ // it's atomic!
			if (err && !err.ok) {
				appendError({'errorData':err,'errorin':'updating machine on pass.'});
				self.res.send('not ok.');
			} else {
				self.res.send('ok'); // Here we wait until save completes before responding.
				delete inProgress[self.req.params.mac];
			}
		});
	}

	function failThang(collectionMachine) {
		dbHyrule.collection('tasks', function(err, collectionTask) {
			if (self.machine.jobs.length && self.machine.jobs[0].started && !self.machine.jobs[0].locked) { // don't pass if locked.
				if (self.machine.jobs[0].tasks.length && self.machine.jobs[0].tasks[0].started) {
					var taskDone = new Object();
					taskDone = self.machine.jobs[0].tasks.shift();
					taskDone.machine = self.machine._id;
					taskDone.job = self.machine.jobs[0]._id;
					taskDone.completed = new Date();
					collectionTask.insert(taskDone);
					if (self.machine.jobs[0].tasks.length==0) {
						var jobDone = new Object();
						jobDone = self.machine.jobs.shift();
						jobDone.machine = self.machine._id;
						jobDone.completed = new Date();
						jobDone.fail = true;
						delete jobDone.tasks;
						dbHyrule.collection('jobs', function(err, collectionJob) {
							collectionJob.insert(jobDone);
						});
					}
					collectionMachine.save(self.machine, {}, function(err,callback){
						if (err && !err.ok) {
							appendError({'errorData':err,'errorin':'updating machine on pass.'});
							self.res.send('not ok.\n');
						} else {
							self.res.send('ok\n');
						}
					});
				} else {
					console.log('no tasks to pass.');
					self.res.send('no tasks to pass.');
				}
			} else if (self.machine.jobs[0].locked) {
				console.log('job is locked!');
				self.res.send('locked.');
			} else {
				console.log('no jobs to pass.');
				self.res.send('no jobs to pass.');
			}
		});
	}

	function task(req, res) {
		self.req = req;
		self.res = res;
		self.start = new Date();
		self.doyourthang = taskThang;
	
		dbHyrule.collection('machines', getMachines);
	}

	function pass(req, res) {
		self.req = req;
		self.res = res;
		self.start = new Date();
		self.taskID = req.params.taskid;
		self.doyourthang = passThang;

		dbHyrule.collection('machines', getMachines);
	}

	function fail(req, res) {
		self.req = req;
		self.res = res;
		self.start = new Date();
		self.taskID = req.params.taskid;
		self.doyourthang = failThang;

		dbHyrule.collection('machines', getMachines);
	}

	this.task = task;
	this.pass = pass;
	this.fail = fail;
	
	return this;
}

var inProgress = new Object();
var lastOverRun = new Date();

zelda.get('/:client(client|moblin)/:mac([0-9a-fA-F]{12}|[0-9a-fA-F]{24})/task', function(req, res){
	var reqTime = new Date();
	if (inProgress[req.params.mac]) {
		inProgress[req.params.mac]++;
		if (inProgress[req.params.mac] >= 3) {
			lastOverRun = new Date();
		}
		if (inProgress[req.params.mac] >= 10) {
			console.log('THE BRAKES!');
			console.log(inProgress);
			defaultPause +=5;
			inProgress[req.params.mac] = 1;
		}
		res.json({task:{pause:defaultPause}});
		return;
	}

	if (reqTime.getTime() - lastOverRun.getTime()>1000 && defaultPause > 50) {
		lastOverRun = new Date();
		defaultPause-=5;
	}
	inProgress[req.params.mac] = new Object();
	inProgress[req.params.mac] = 1;
	var zCurrent = new Client(req.params.mac);
	zCurrent.task(req, res);
});

zelda.post('/:client(client|moblin)/:mac([0-9a-fA-F]{12}|[0-9a-fA-F]{24})/pass/:taskid([0-9a-fA-F]{24})?', function(req, res){
	if (inProgress[req.params.mac]) {
		res.json({task:{pause:defaultPause}});
		overRun++;
		return;
	}
	var zCurrent = new Client(req.params.mac);
	zCurrent.pass(req, res);
});

zelda.post('/:client(client|moblin)/:mac([0-9a-fA-F]{12}|[0-9a-fA-F]{24})/fail/:taskid([0-9a-fA-F]{24})?', function(req, res){
	if (inProgress[req.params.mac]) {
		res.json({task:{pause:defaultPause}});
		overRun++;
		return;
	}
	console.log('got a fail');
	console.log(req.params.taskid);
	var zCurrent = new Client(req.params.mac);
	zCurrent.fail(req, res);
});

zelda.get('/version', function(req,res) {
	fs.readFile('package.json', 'utf8', function(err,data) {
		if (err) throw err;
		var jsonPackage = JSON.parse(data);
		zelda.version = jsonPackage.version;
		res.send(zelda.version);
	});
});

zelda.listen(3000);

