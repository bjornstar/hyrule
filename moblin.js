var spawn   = require('child_process').spawn;
var http    = require('http');
var os      = require('os');
var crypto  = require('crypto');
var fs      = require('fs');
var util    = require('util');

var appName = 'moblin';
var appStart = new Date();

var zeldaIP = '10.30.0.73';

console.log('['+new Date().toISOString()+'] Welcome to Hyrule.');

var moblin = new Object();

fs.readFile('package.json', 'utf8', function(err, data) {
  if (err) throw err;
  var jsonPackage = JSON.parse(data);
  moblin.version = jsonPackage.version;
  console.log('['+new Date().toISOString()+'] You are '+appName+' in Hyrule v'+moblin.version);
});

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

console.log('['+new Date().toISOString()+'] I dub thee moblin_'+moblin.name+'.');

var zeldaAgent = new http.Agent();
zeldaAgent.maxSockets = 1;

var zeldaAgentVersion = new http.Agent();
zeldaAgentVersion.maxSockets = 5;

var zeldaTask = {
  agent: zeldaAgent,
  host: zeldaIP,
  method: 'GET',
  path: '/moblin/'+moblin.name+'/task',
  port: 3000
};

var zeldaVersion = {
  agent: zeldaAgentVersion,
  host: zeldaIP,
  method: 'GET',
  path: '/version',
  port: 3000
};

moblin.heartRate = 50;
moblin.EKGRate = 5000;
moblin.umbilicalCord = false;
moblin.beatCount = 0;
moblin.eatCount = 0;
moblin.prevBeatCount = 0;
moblin.prevEatCount = 0;
moblin.checkCount = 0;
moblin.prevCheckCount = 0;

var moblinHeartBeatInterval = setInterval(moblinHeartBeat, moblin.heartRate);
var moblinEKGInterval = setInterval(moblinEKG, moblin.EKGRate);

function moblinEKG () {
  if (Math.round(moblin.EKGRate/(moblin.beatCount-moblin.prevBeatCount))!=moblin.heartRate||Math.round(moblin.EKGRate/(moblin.eatCount-moblin.prevEatCount))!=moblin.heartRate) {
    console.log('['+new Date().toISOString()+'] Irregular Heartbeat! '+Math.round(moblin.EKGRate/(moblin.beatCount-moblin.prevBeatCount))+' '+Math.round(moblin.EKGRate/(moblin.eatCount-moblin.prevEatCount)));
  }
  moblin.prevBeatCount = moblin.beatCount;
  moblin.prevEatCount = moblin.eatCount;
}

function moblinVersionCheck () {
  moblin.checkCount++;

  var versionRequest = http.request(zeldaVersion, function(res) {
    res.setEncoding('utf8');
    res.on('data', function resVersionData(data) {
      handleVersionCheck(data);
    });
    res.on('close', function resVersionClose(error) {
      console.log(error);
    });
  });

  versionRequest.on('error', function versionRequestError(socketException) {
    handleRequestError(socketException);
    if (!moblin.timeoutVersionCheck){
      moblin.timeoutVersionCheck = setTimeout(moblinVersionCheck, 1000);
    }
  });

  versionRequest.end();
}

moblin.timeoutVersionCheck = setTimeout(moblinVersionCheck, 1000);

function handleVersionCheck(data) {
  if (!moblin.umbilicalCord) {
    console.log('['+new Date().toISOString()+'] Found Zelda.');
    moblin.umbilicalCord = true;
  }
  console.log('['+new Date().toISOString()+'] Zelda says she is in Hyrule v'+data);
  moblin.prevCheckCount = moblin.checkCount;
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

  var taskRequest = http.request(zeldaTask, function(res) {
    res.setEncoding('utf8');
    res.on('data', function resTaskData(data) {
      digestTask(data);
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
    console.log('['+new Date().toISOString()+'] Found Zelda.');
    moblin.umbilicalCord = true;
  }

  if(task.pause && moblin.heartRate != task.pause) {
    console.log('['+new Date().toISOString()+'] Changing heart rate from '+moblin.heartRate+' to '+task.pause+'.');
    moblin.heartRate = task.pause;
    clearInterval(moblinHeartBeatInterval);
    moblinHeartBeatInterval = setInterval(moblinHeartBeat, moblin.heartRate);
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
