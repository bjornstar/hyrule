var	db		= require('mongodb').Db,
	server		= require('mongodb').Server,
	express		= require('express');

console.log('Welcome to Hyrule.');
console.log(new Date());

var defaultPause = 250;

var hyrule = new db('hyrule', new server('localhost', 27017, {}));

var zelda = express.createServer();
zelda.use(express.bodyParser());

function Client(mac) {
	var self = this;

	this.mac = mac;
	this.taskOut = {task:{pause:defaultPause}, default: true, created:new Date()};

	this.appendError = function(errorObject) {
		console.log(errorObject);
		if (!self.taskOut.errors||self.taskOut.errors.length==0) {
			self.taskOut.errors = new Array();
		}
		self.taskOut.errors.push({'error':errorObject,_id:new hyrule.bson_serializer.ObjectID(),'created':new Date()});
	}

	function getMachines(errCollection, collectionMachine, callback) {
		console.log('start of getMachines');
		if (errCollection!=null) {
			self.appendError({'errordata':errCollection,'errorin':'hyrule.collection(\'machines\')'});
		}
		collectionMachine.findAndModify(
			{'mac':mac},
			[],
			{'$set':{'lastseen':new Date()}, '$inc':{'timesseen':1}}, {'safe': true, 'new': true, 'upsert': true},
			function(famErr, famMachine) {
console.log('find and modified.');
				if (!famErr.ok) {
					self.appendError({'errordata':famErr,'errorin':'collectionMachine.findAndModify'});
				}
				if (famMachine!=null) {
					if (famMachine.timesseen==1) {
						famMachine.created = new Date();
					}
					if (!famMachine.tasks||famMachine.tasks.length==0) {
						famMachine.tasks = new Array();
						famMachine.tasks.push({task:{pause:defaultPause}, _id: new hyrule.bson_serializer.ObjectID(), created: new Date()});
					}
					if (!famMachine.tasks[famMachine.tasks.length-1].started) {
						famMachine.tasks[famMachine.tasks.length-1].started = new Date();
						collectionMachine.save(famMachine, {safe:true}, function(errSave,callback){
							if (errSave!=null) {
								self.appendError({'errordata':errSave,'errorin':'collectionMachine.save'});
							}
						});
					}
					self.taskOut = famMachine.tasks[famMachine.tasks.length-1];
				} else {
					self.appendError({'errordata':famErr,'errorin':'collectionMachine.findAndModify:no results'});
				}
		});
	}

	function manythings(errOpen, db_pi, callback){
		console.log('start of many things');
		if (errOpen!=null) {
			var errorObject = {'errordata':errOpen,'errorin':'hyrule.open'}
			self.appendError(errorObject);
		} else {
			hyrule.collection('machines', getMachines);
		}
	}


	hyrule.open(manythings);

	console.log(self.mac+' initialized, returning now.');
	return this;
}


zelda.get('/client/:mac/task', function(req, res){
	console.log(req.params.mac.toLowerCase()+' received request, initializing client.');
	var myClient = new Client(req.params.mac.toLowerCase());
	console.log(req.params.mac.toLowerCase()+' client initialized.');
	res.send(myClient.taskOut);
});


zelda.post('/client/:mac/pass', function(req, res){
 	var taskOut = {task:{pause:defaultPause}};
	hyrule.open(function(errOpen, db_p){
		if (errOpen!=null) {
			taskOut.error = {'error':{'errortime':new Date(),'errordata':errOpen,'errorin':'/client/:mac/pass'}};
		} else {
	                hyrule.collection('machines', function(err, collectionMachine) {
        	                collectionMachine.findAndModify(
                	                {'mac':req.params.mac.toLowerCase()},
                        	        [],
                                	{'$set':{'lastseen':new Date()}, '$inc':{'timesseen':1}}, {'safe': true, 'new': true, 'upsert': true},
	                                function(err, cursorMachine) {
        	                                if(cursorMachine.timesseen==1){
                	                                cursorMachine.created = new Date();
                        	                }
						if(!cursorMachine.tasks||cursorMachine.tasks.length==0){
                                        	        cursorMachine.tasks = new Array();
							cursorMachine.tasks.push({task:{pause:defaultPause}, _id: new hyrule.bson_serializer.ObjectID(), created: new Date()});
						}
						hyrule.collection('tasks', function(err, collectionTask) {
							taskDone = cursorMachine.tasks.pop();
							taskDone.machine = cursorMachine._id;
							taskDone.completed = new Date();
							collectionTask.insert(taskDone);
						});
						collectionMachine.save(cursorMachine, {safe:true}, function(err,callback){
							//res.send('ok');
						});
				});
			});
		}
	});
	if (taskOut.error!=null) {
		console.log(taskOut);
	}
	res.send(taskOut);
});

zelda.get('/client/:mac/create', function(req,res){
	hyrule.open(function(err, db_p){
		hyrule.collection('machines', function(err, collectionMachine) {
			collectionMachine.findAndModify(
				{'mac':req.params.mac.toLowerCase()},
				[],
				{'$set':{'lastseen':new Date()}, '$inc':{'timesseen':1}}, {'safe': true, 'new': true, 'upsert': true},
				function(err, cursorMachine) {
					if (cursorMachine.timesseen==1) {
						cursorMachine.created = new Date();
					}
					if(!cursorMachine.tasks||cursorMachine.tasks.length==0){
						cursorMachine.tasks = new Array();
						cursorMachine.tasks.push({task:{pause:defaultPause}, _id: new hyrule.bson_serializer.ObjectID(), created: new Date()});
					}

					cursorMachine.tasks.push({task:{execpass:'ping -n 5 horcrux'}, _id: new hyrule.bson_serializer.ObjectID(), created: new Date()});
					collectionMachine.save(cursorMachine, {safe:true}, function(err,callback){
					//	res.send('ok');
					});
			});
		});
	});
	res.send('ok');
});

zelda.listen(3000);

