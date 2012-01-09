var spawn   = require('child_process').spawn;
var http    = require('http');
var os      = require('os');
var crypto  = require('crypto');

var appName = 'Moblin';
console.log(new Date()+': Welcome to Hyrule.');

var moblin = new Object();

var intInc = 0;

if (os.hostname().match(/([0-9a-fA-F]{12})|([0-9a-fA-F]{24})/)) {
	moblin.name = os.hostname();
} else {
	moblin.name = generateObjectId();
}

function generateObjectId() {
  var nameNew = '';
  var timePortion = parseInt(new Date().getTime().toString().substr(0,10)).toString(16);
  nameNew += timePortion;

  var hostPortion = crypto.createHash('md5').update(os.hostname()).digest('hex').substr(0,6);
  nameNew += hostPortion;

  var processPortion = process.pid.toString(16).substr(0,4);
  while (processPortion.length<4) {
    processPortion = '0'+processPortion;
  }
  nameNew += processPortion;

  intInc++;
  var incPortion = parseInt(intInc).toString(16).substr(0,6);
  while (incPortion.length<6) {
    incPortion = '0'+incPortion;
  }
  nameNew += incPortion;

  return nameNew;
}

console.log(new Date()+': I dub thee moblin_'+moblin.name+'.');

var horcruxAgent = new http.Agent();
horcruxAgent.maxSockets = 1;

var horcruxTask = {
  agent: horcruxAgent,
  host: 'horcrux',
  method: 'GET',
  path: '/moblin/'+moblin.name+'/task',
  port: 3000
};

var moblinHeartRate = 1;
var moblinHeartBeatInterval = setInterval(moblinHeartBeat, moblinHeartRate);

var start = new Date();
var beatCount = 0;

moblin.umbilicalCord = false;

function moblinHeartBeat () {
  beatCount++;
  var heartTime = new Date();
//  console.log(beatCount + ' ' + (heartTime.getTime()-start));

  var taskRequest = http.request(horcruxTask, function(res) {
    res.setEncoding('utf8');
    res.on('data', function responseData(data) {
      digestTask(data);
    });
    res.on('close', function responseClose(error) {
      console.log(error);
    });
  });

  taskRequest.on('error', function taskRequestError(socketException) {
    switch(socketException.code) {
      case 'ECONNRESET':
        console.log(new Date()+': Horcrux just crashed.');
	moblin.umbilicalCord = false;
        break;
      case 'ECONNREFUSED':
        console.log(new Date()+': Horcrux isn\'t up.');
	moblin.umbilicalCord = false;
        break;
      default:
        console.log(socketException);
    }
  });

  taskRequest.end();
}

var eaten = 0;

function digestTask(chunk) {
  eaten++;
  var eatTime = new Date();
//  console.log('                 '+eaten+' '+(eatTime.getTime()-start));

  var tastyBits = JSON.parse(chunk);
  var task = tastyBits.task;

  if (!moblin.umbilicalCord) {
    console.log(new Date()+': Connection to horcrux established.');
    moblin.umbilicalCord = true;
  }

  if(task.pause && moblinHeartRate != task.pause) {
    console.log(new Date()+': Changing heart rate from '+moblinHeartRate+' to '+task.pause+'.');
    moblinHeartRate = task.pause;
    clearInterval(moblinHeartBeatInterval);
    moblinHeartBeatInterval = setInterval(moblinHeartBeat, moblinHeartRate);
  } else if (task.pause) {
    return;
  }
  
  if(task.rdmsr!=null) {
    console.log(tastyBits._id);
  }
}

/*var pingy = spawn('ping', ['-n','5','10.30.0.73']);

pingy.stdout.on('data', function (data) {
  console.log('pingy: ' + data);
});

pingy.stderr.on('data', function (data) {
  console.log('pingyerr: ' + data);
});
  
pingy.on('exit', function (code) {
  console.log('pingy exited with code ' + code);
});*/
