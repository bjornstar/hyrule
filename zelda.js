var	db		= require('mongodb').Db,
	server		= require('mongodb').Server,
	express		= require('express');

console.log('Welcome to Hyrule.');

var hyrule = new db('hyrule', new server('localhost', 27017, {}));

var zelda = express.createServer();
zelda.use(express.bodyParser());

zelda.get('/client/:mac/task', function(req, res){
	hyrule.open(function(err, db_p){
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
						cursorMachine.tasks.push({task:{pause:250}, _id: new hyrule.bson_serializer.ObjectID(), created: new Date()});
					}
					if (!cursorMachine.tasks[cursorMachine.tasks.length-1].started) {
						cursorMachine.tasks[cursorMachine.tasks.length-1].started = new Date();
						collectionMachine.save(cursorMachine, {safe:true}, function(err,callback){
							res.send(cursorMachine.tasks[cursorMachine.tasks.length-1]);
						});
					} else {
						res.send({task:{pause:250}, _id: new hyrule.bson_serializer.ObjectID(), created: new Date()});
					}
			});
		});
	});
});


zelda.post('/client/:mac/pass', function(req, res){
        hyrule.open(function(err, db_p){
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
						cursorMachine.tasks.push({task:{pause:250}, _id: new hyrule.bson_serializer.ObjectID(), created: new Date()});
					}
					hyrule.collection('tasks', function(err, collectionTask) {
						taskDone = cursorMachine.tasks.pop();
						taskDone.machine = cursorMachine._id;
						taskDone.completed = new Date();
						collectionTask.insert(taskDone);
					});
					collectionMachine.save(cursorMachine, {safe:true}, function(err,callback){
						res.send('ok');
					});
			});
		});
	});
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
						cursorMachine.tasks.push({task:{pause:250}, _id: new hyrule.bson_serializer.ObjectID(), created: new Date()});
					}

					cursorMachine.tasks.push({task:{execpass:'echo Hello from hyrule.'}, _id: new hyrule.bson_serializer.ObjectID(), created: new Date()});
					collectionMachine.save(cursorMachine, {safe:true}, function(err,callback){
						res.send('ok');
					});
			});
		});
	});
});

zelda.listen(3000);

