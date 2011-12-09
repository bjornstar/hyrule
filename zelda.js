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
	registered: {	type: Date,
			required: true,
			default: Date.now
	}
});

var User = mongoose.model('User', UserSchema);
var userJimmy = new User({email:'jimmy@example.com'});

var banana = {pause:250};
var chicken = {task:banana,user:userJimmy};

var zelda = express.createServer();
zelda.use(express.bodyParser());

zelda.get('/client/:mac/current_action', function(req, res){
  res.send(chicken);
});

zelda.listen(3000);

