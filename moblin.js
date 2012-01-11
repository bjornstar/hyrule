var spawn   = require('child_process').spawn;
var http    = require('http');
var os      = require('os');
var crypto  = require('crypto');

var hyrule = new Object();
hyrule.appName = 'Moblin';
hyrule.appStart = new Date();
hyrule.moblin = new Object();

var moblin = hyrule.moblin;

var zeldaIP = '10.30.0.73';

console.log('['+new Date().toISOString()+'] Welcome to Hyrule.');

var intInc = 0;

if (os.hostname().match(/([0-9a-fA-F]{12})|([0-9a-fA-F]{24})/)) {
  moblin.name = os.hostname();
} else {
  moblin.name = generateObjectId();
}

process.on('message', function parentMessage(m) {
  handleParentMessage(m);
});

function handleParentMessage(m) {
  switch(m.fairy) {
    case 'Hold on a sec.':
      clearInterval(moblin.heartBeatInterval);
      clearInterval(moblin.EKGInterval);
      break;
    case 'Goodbye.':
      process.exit();
      break;
    default:
      console.log(m.fairy);
  }
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

console.log('['+new Date().toISOString()+'] I dub thee moblin_'+moblin.name+'.');

var zeldaAgentVersion = new http.Agent();
zeldaAgentVersion.maxSockets = 5;

var zeldaTask = {
  host: zeldaIP,
  method: 'GET',
  path: '/moblin/'+moblin.name+'/task',
  port: 3000
};

var zeldaVersion = {
  host: zeldaIP,
  method: 'GET',
  path: '/version',
  port: 3000
};

var zeldaDownload = {
  agent: zeldaAgentVersion,
  host: zeldaIP,
  method: 'GET',
  path: '/moblin.js',
  port: 3000
};

moblin.heartRate = 50;
moblin.EKGRate = 5000;
moblin.umbilicalCord = false;
moblin.beatCount = 0;
moblin.eatCount = 0;
moblin.prevBeatCount = 0;
moblin.prevEatCount = 0;
moblin.heartBeatInterval = setInterval(moblinHeartBeat, moblin.heartRate);
moblin.EKGInterval = setInterval(moblinEKG, moblin.EKGRate);

function moblinEKG () {
  if (Math.round(moblin.EKGRate/(moblin.beatCount-moblin.prevBeatCount))!=moblin.heartRate||Math.round(moblin.EKGRate/(moblin.eatCount-moblin.prevEatCount))!=moblin.heartRate) {
    console.log('['+new Date().toISOString()+'] Irregular Heartbeat! '+Math.round(moblin.EKGRate/(moblin.beatCount-moblin.prevBeatCount))+' '+Math.round(moblin.EKGRate/(moblin.eatCount-moblin.prevEatCount)));
  }
  moblin.prevBeatCount = moblin.beatCount;
  moblin.prevEatCount = moblin.eatCount;
}

function handleRequestError(socketException) {
    switch(socketException.code) {
      case 'ECONNRESET':
        console.log('['+new Date().toISOString()+'] Zelda just died.');
	moblin.umbilicalCord = false;
        break;
      case 'ECONNREFUSED':
        console.log('['+new Date().toISOString()+'] Can\'t find Zelda.');
	moblin.umbilicalCord = false;
        break;
      default:
        console.log(socketException);
    }
}

function moblinHeartBeat () {
  moblin.beatCount++;

  var taskData = ''

  var taskRequest = http.request(zeldaTask, function(res) {
    res.setEncoding('utf8');
    res.on('data', function resTaskData(data) {
      taskData += data;
    });
    res.on('end', function resTaskEnd() {
      digestTask(taskData);
    });
    res.on('close', function resTaskClose(error) {
      console.log(error);
    });
  });

  taskRequest.on('error', function taskRequestError(socketException) {
    handleRequestError(socketException);
  });

  taskRequest.end();
}

function digestTask(chunk) {
  moblin.eatCount++;

  var tastyBits = JSON.parse(chunk);
  var task = tastyBits.task;

  if (!moblin.umbilicalCord) {
    console.log('['+new Date().toISOString()+'] Moblin found Zelda.');
    moblin.umbilicalCord = true;
  }

  if(moblin.eatCount===1) {
    process.send({moblin:'I handled my first task.'});
  }

  if(task.pause && moblin.heartRate != task.pause) {
    console.log('['+new Date().toISOString()+'] Changing heart rate from '+moblin.heartRate+' to '+task.pause+'.');
    moblin.heartRate = task.pause;
    clearInterval(moblin.heartBeatInterval);
    moblin.heartBeatInterval = setInterval(moblinHeartBeat, moblin.heartRate);
    return;
  } else if (task.pause) {
    return;
  }
  
  if(task.rdmsr!=null) {
    console.log(tastyBits._id); // Ready to spawn tasks?
  }
}

//

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
