var spawn   = require('child_process').spawn;
var http    = require('http');
var os      = require('os');
var util    = require('util');

var appName = 'Moblin';
console.log('Welcome to Hyrule.');

var moblin = new Object();

if (os.hostname().match(/([0-9a-fA-F]{12})|([0-9a-fA-F]{24})/)) {
	moblin.hostname = os.hostname();
} else {
	moblin.hostname = 'deadbeefdead';
}

console.log('I dub thee moblin_'+moblin.hostname);

var horcruxAgent = new http.Agent();
horcruxAgent.maxSockets = 1;

var horcruxTask = {
  agent: horcruxAgent,
  host: 'horcrux',
  method: 'GET',
  path: '/moblin/'+moblin.hostname+'/task',
  port: 3000
};

var moblinHeartRate = 1;
var moblinHeartBeatInterval = setInterval(moblinHeartBeat, moblinHeartRate);

var start = new Date();
var beatCount = 0;

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
        console.log('Horcrux just crashed');
        break;
      case 'ECONNREFUSED':
        console.log('Horcrux isn\'t up');
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

  if(task.pause && moblinHeartRate != task.pause) {
    console.log('Changing heart rate from '+moblinHeartRate+' to '+task.pause+'.');
    moblinHeartRate = task.pause;
    clearInterval(moblinHeartBeatInterval);
    moblinHeartBeatInterval = setInterval(moblinHeartBeat, moblinHeartRate);
  } else if (task.pause) {
    return
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
