var	mongodb		= require('mongodb');
var	express		= require('express');

var serverHorcrux = new mongodb.Server('localhost', 27017);
var dbHyrule = new mongodb.Db('hyrule', serverHorcrux, {});

console.log('Welcome to Hyrule.');
console.log(new Date());

var defaultPause = 50;

var zelda = express.createServer();
zelda.use(express.bodyParser());

function Client(mac) {
	var self = this; //You have to do this so you can reference these things later.
	var machine;

	this.mac = mac.toLowerCase();
	this.taskOut = {task:{pause:defaultPause}, default: true, created:new Date()}; // This is the default task.

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
				if (!famErr.ok) {
					self.appendError({'errordata':famErr,'errorin':'collectionMachine.findAndModify'});
					self.res.json(self.taskOut);
				} else {
					if (famMachine!=null) {
						self.machine = famMachine;
						if (!self.machine.created || !self.machine.tasks) {
							self.machine.created = new Date();
							self.machine.tasks = new Array();
							collectionMachine.save(self.machine, {'safe':true}, function(errSave){
								if (!errSave.ok) {
									appendError({'errordata':errSave,'errorin':'initial created and tasks'});
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
		if (self.machine.tasks.length && !self.machine.tasks[0].started) { // This is where you'll need to put in logic about simultaneous script running.
			console.log('Starting new task on the client.');
			console.log(self.machine.tasks[self.machine.tasks.length-1]);
			self.machine.tasks[0].started = new Date();
			collectionMachine.save(self.machine, {'safe':true}, function(errSave){
				if (!errSave.ok) {
					self.appendError({'errordata':errSave,'errorin':'collectionMachine.save'});
					self.res.json(self.taskOut);
				} else {
					self.taskOut = self.machine.tasks[self.machine.tasks.length-1];
					self.res.json(self.taskOut);
				}
			});
		} else {
			self.res.json(self.taskOut);
		}
	}

	function createThang(collectionMachine) {
		self.machine.tasks.push({task:{execpass:'ping -n 5 horcrux'}, _id: new dbHyrule.bson_serializer.ObjectID(), created: new Date()});
		collectionMachine.save(self.machine, {'safe':true}, function(err,callback){
			if(!err.ok) {
				appendError({'errorData':err,'errorin':'creating a task.'});
				self.res.send('failed to create.');
			} else {
				self.res.send('ok');
			}
		});
	}

	function passThang(collectionMachine) {
		dbHyrule.collection('tasks', function(err, collectionTask) {
			if (self.machine.tasks.length && self.machine.tasks[0].started) {
				var taskDone = new Object();
				taskDone = self.machine.tasks.shift();
				taskDone.machine = self.machine._id;
				taskDone.completed = new Date();
				collectionTask.insert(taskDone);
				collectionMachine.save(self.machine, {'safe':true}, function(err,callback){
					if (!err.ok) {
						appendError({'errorData':err,'errorin':'updating machine on pass.'});
						self.res.send('not ok.');
					} else {
						self.res.send('ok');
					}
				});
			} else {
				console.log('no tasks to pass.');
				self.res.send('no tasks to pass.');
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

dbHyrule.open(function() {
	console.log('db opened.')
});

zelda.get('/client/:mac/task', function(req, res){
	var zCurrent = new Client(req.params.mac);
	zCurrent.task(req, res);
});


zelda.post('/client/:mac/pass', function(req, res){
	var zCurrent = new Client(req.params.mac);
	zCurrent.pass(req, res);
});

/*	console.log('we got a pass.');
 	var taskOut = {task:{pause:defaultPause}};
	dbHyrule.collection('machines', function(err, collectionMachine) {
		collectionMachine.findAndModify(
			{'mac':req.params.mac.toLowerCase()},
			[],
			{'$set':{'lastseen':new Date()}, '$inc':{'timesseen':1}},
			{'safe': true, 'new': true, 'upsert': true},
			function(err, cursorMachine) {
				if (!err) {
					console.log('pass.fam');
					console.log(err);
				} else {
					if(cursorMachine.timesseen==1){
						cursorMachine.created = new Date();
					}
					if(!cursorMachine.tasks||cursorMachine.tasks.length==0){
						cursorMachine.tasks = new Array();
						cursorMachine.tasks.push({task:{pause:defaultPause}, _id: new dbHyrule.bson_serializer.ObjectID(), created: new Date()});
					}
				}
			});
	});
});*/

zelda.get('/client/:mac/create', function(req,res){
	var zCurrent = new Client(req.params.mac);
	zCurrent.create(req, res);
});
/*	dbHyrule.collection('machines', function(err, collectionMachine) {
		collectionMachine.findAndModify(
			{'mac':req.params.mac.toLowerCase()},
			[],
			{'$set':{'lastseen':new Date()}, '$inc':{'timesseen':1}}, {'safe': true, 'new': true, 'upsert': true},
			function(err, cursorMachine) {
				if (!err) {
					console.log(err);
				} else {
					if (cursorMachine.timesseen==1) {
						cursorMachine.created = new Date();
					}
					if(!cursorMachine.tasks||cursorMachine.tasks.length==0){
						cursorMachine.tasks = new Array();
						cursorMachine.tasks.push({task:{pause:defaultPause}, _id: new dbHyrule.bson_serializer.ObjectID(), created: new Date()});
					}

				}
		});
	});
	res.send('ok');
});*/

zelda.listen(3000);

