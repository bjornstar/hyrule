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
			default: Date.now
	},
	firstseen: {	type: Date,
			required: true,
			default: Date.now
	}
});

var MachineSchema = new Schema({
	mac: {		type: String,
			required: true,
			index: {unique: true},
			lowercase: true
	},
	lastseen: {	type: Date,
			default: Date.now
	},
	firstseen: {	type: Date,
			default: Date.now
	}
});

var User = mongoose.model('User', UserSchema);

var Machine = mongoose.model('Machine', MachineSchema);

var banana = {pause:250};
var chicken = {task:banana};

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
		chicken.machine = qMachine;
		res.send(chicken);
	});
});

zelda.listen(3000);

