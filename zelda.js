var	mongoose	= require('mongoose'),
	express		= require('express');

var db = mongoose.connect('mongodb://localhost/hyrule');
var Schema = mongoose.Schema;

var TaskSchema = new Schema({
	task:	 {},
	created: {	type: Date,
			required: true,
			default: Date.now()
	},
	started: {	type: Date
	}
});

var MachineSchema = new Schema({
	mac: {		type: String,
			index: {unique: true},
			lowercase: true,
			required: true
	},
	lastseen: {	type: Date,
			default: Date.now()
	},
	firstseen: {	type: Date,
			default: Date.now()
	},
	tasks:	[TaskSchema]
});

var Machine =	mongoose.model('Machine', MachineSchema);
var Task =	mongoose.model('Task', TaskSchema);

var zelda = express.createServer();
zelda.use(express.bodyParser());

zelda.get('/client/:mac/task', function(req, res){
	Machine.findOne(
		{mac:req.params.mac.toLowerCase()}, function(err,qMachine){
		if (err){
			console.log(err);
		}
		if (qMachine){
			qMachine.lastseen = Date.now();
		} else {
			qMachine = new Machine();
			qMachine.mac = req.params.mac;
		}
		if (qMachine.tasks.length>0){
			console.log(qMachine.tasks);
			qTask = qMachine.tasks[0];
		} else {
			qTask = new Task();
			qTask.task = {pause:250};
			qTask.start = Date.now();
			qMachine.tasks.push(qTask);
		}
		qMachine.save(function (err) {
			if (err){
				console.log(err);
			}
		});
		res.send(qTask);
	});
});

zelda.listen(3000);

