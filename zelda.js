var	mongodb		= require('mongodb');
var	express		= require('express');

var serverHorcrux = new mongodb.Server('localhost', 27017);
var dbHyrule = new mongodb.Db('hyrule', serverHorcrux, {});

console.log('Hello Zelda, welcome to Hyrule.');
console.log(new Date());

var defaultPause = 50;

var zelda = express.createServer();
zelda.use(express.bodyParser());

function Client(mac) {
	var self = this; //You have to do this so you can reference these things later.
	var machine;

	this.mac = mac.toLowerCase();
	this.taskOut = {task:{pause:defaultPause},_id:new dbHyrule.bson_serializer.ObjectID(),created:new Date()}; // This is the default task.

	this.appendError = function(errorObject) {
		console.log(errorObject);
		if (!self.taskOut.errors||self.taskOut.errors.length==0) {
			self.taskOut.errors = new Array();
		}
		self.taskOut.errors.push({'error':errorObject,_id:new dbHyrule.bson_serializer.ObjectID(),'created':new Date()});
	}

	function getMachines(errCollection, collectionMachine, callback) {
		if (errCollection!=null) {
			self.appendError({'errordata':errCollection,'errorin':'hyrule.collection(\'machines\')'});
			self.res.json(self.taskOut);
		} else {
			collectionMachine.findAndModify(
			{'mac':self.mac},
			[],
			{'$set':{'lastseen':new Date()}, '$inc':{'timesseen':1}}, {'safe':true, 'new':true, 'upsert':true},
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
							collectionMachine.save(self.machine, {'safe':true}, function(errSave){
								if (errSave && !errSave.ok) {
									appendError({'errordata':errSave,'errorin':'initial created and/or jobs'});
								}
							});
						}

// Every request from the client, we need to do up to here. ^^^^^^^^^^^^^

	self.doyourthang(collectionMachine);

// And after here. vvvvvvvvvvv

					} else {
						self.appendError({'errordata':famErr,'errorin':'collectionMachine.findAndModify:no results'});
						self.res.json(self.taskOut);
					}
				}
			});
		}
	}

	function taskThang(collectionMachine) {
		if (self.machine.jobs.length) {
			if (!self.machine.jobs[0].started) {
				var jobStarted = new Date();
				var jobTimeout = new Date(jobStarted.getTime() + self.machine.jobs[0].duration);
				self.machine.jobs[0].started = jobStarted;
				self.machine.jobs[0].timeout = jobTimeout;
			}
			if (self.machine.jobs[0].tasks.length && !self.machine.jobs[0].tasks[0].started && !self.machine.jobs[0].locked) { //don't send if locked.
				taskStarted = new Date();
				taskTimeout = new Date(taskStarted.getTime() + self.machine.jobs[0].tasks[0].duration);
				self.machine.jobs[0].tasks[0].started = taskStarted;
				self.machine.jobs[0].tasks[0].timeout = taskTimeout;
				collectionMachine.save(self.machine, {'safe':true}, function(errSave){
					if (errSave && !errSave.ok) {
						self.appendError({'errordata':errSave,'errorin':'collectionMachine.save'});
						self.res.json(self.taskOut);
					} else {
						self.taskOut = self.machine.jobs[0].tasks[0];
						self.res.json(self.taskOut);
					}
				});
			} else {
				self.res.json(self.taskOut);
			}
		} else {
			self.res.json(self.taskOut);
		}
	}

	function createThang(collectionMachine) {
		var jobDate = new Date();
		self.machine.jobs.push({_id: new dbHyrule.bson_serializer.ObjectID(), created: jobDate, tasks: new Array(), duration:110000});
		var n;
		for(n=1;n<=10;n++) {
			var taskDate = new Date();
			var taskDuration = n*2000;
			self.machine.jobs[self.machine.jobs.length-1].tasks.push(
				{task:{execpass:'ping -n '+n+' horcrux'}, _id: new dbHyrule.bson_serializer.ObjectID(), created: taskDate, duration: taskDuration}
			);
		}
		collectionMachine.save(self.machine, {'safe':true}, function(err,callback){
			if(err && !err.ok) {
				appendError({'errorData':err,'errorin':'creating a task.'});
				self.res.send('failed to create.\n');
			} else {
				self.res.send('ok\n');
			}
		});
	}

	function passThang(collectionMachine) {
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
						delete jobDone.tasks;
						dbHyrule.collection('jobs', function(err, collectionJob) {
							collectionJob.insert(jobDone);
						});
					}
					collectionMachine.save(self.machine, {'safe':true}, function(err,callback){
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
			} else {
				console.log('no jobs to pass.');
				self.res.send('no jobs to pass.');
			}
		});
	}

	function task(req, res) {
		self.req = req;
		self.res = res;
		self.doyourthang = taskThang;

		dbHyrule.collection('machines', getMachines);
	}

	function create(req, res) {
		self.req = req;
		self.res = res;
		self.doyourthang = createThang;

		dbHyrule.collection('machines', getMachines);
	}

	function pass(req, res) {
		self.req = req;
		self.res = res;
		self.doyourthang = passThang;

		dbHyrule.collection('machines', getMachines);
	}

	this.task = task;
	this.create = create;
	this.pass = pass;
	
	return this;
}

dbHyrule.open(function() {});

zelda.get('/client/:mac([0-9a-fA-F]+)/task', function(req, res){
	var zCurrent = new Client(req.params.mac);
	zCurrent.task(req, res);
});


zelda.post('/client/:mac/pass/:taskid', function(req, res){
	console.log(req.params.taskid);
	var zCurrent = new Client(req.params.mac);
	zCurrent.pass(req, res);
});

zelda.post('/client/:mac/pass', function(req, res){
	var zCurrent = new Client(req.params.mac);
	zCurrent.pass(req, res);
});

zelda.get('/client/:mac/create', function(req,res){
	var zCurrent = new Client(req.params.mac);
	zCurrent.create(req, res);
});

zelda.get('/client/:mac/fail/:taskid', function(req, res){
	console.log('failed' + req.params.taskid);
});

zelda.get('/client/:mac/fail', function(req, res){
	console.log('something failed');
});

zelda.listen(3000);

