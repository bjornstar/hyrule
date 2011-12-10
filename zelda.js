var	mongoose	= require('mongoose'),
	express		= require('express');

var db = mongoose.connect('mongodb://localhost/hyrule');
var Schema = mongoose.Schema;

var UserSchema = new Schema({
	email: {	type: String,
			required: true,
			index: {unique: true},
			lowercase: true
	},
	lastseen: {	type: Date,
			required: true,
			default: Date.now()
	},
	firstseen: {	type: Date,
			required: true,
			default: Date.now()
	}
});

var MachineSchema = new Schema({
	mac: {		type: String,
			required: true,
			index: {unique: true},
			lowercase: true
	},
	lastseen: {	type: Date,
			required: true,
			default: Date.now()
	},
	firstseen: {	type: Date,
			required: true,
			default: Date.now()
	}
});

var TaskSchema = new Schema({
	machine: [MachineSchema],
	task:	 {},
	created: {	type: Date,
			required: true,
			default: Date.now()
	},
	start: {	type: Date
	}
});

var User =	mongoose.model('User', UserSchema);
var Machine =	mongoose.model('Machine', MachineSchema);
var Task =	mongoose.model('Task', TaskSchema);

var zelda = express.createServer();
zelda.use(express.bodyParser());

zelda.get('/client/:mac/task', function(req, res){
	Machine.findOne({mac:req.params.mac.toLowerCase()}, function(err,qMachine){
		if (qMachine) {
			qMachine.lastseen = Date.now();
		} else {
			qMachine = new Machine({mac:req.params.mac});
		}
		qMachine.save();

		Task.findOne({machine:qMachine}, function(err,qTask) {
			if (qTask) {
				qTask.start = Date.now();
			} else {
				qTask = new Task();
				qTask.start = Date.now();
				qTask.task = {pause:250};
				qTask.machine = qMachine;
			}
			qTask.save();
			res.send(qTask);
		});
	});
});

zelda.listen(3000);

