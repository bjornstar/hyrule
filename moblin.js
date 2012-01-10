var spawn   = require('child_process').spawn;
var http    = require('http');
var os      = require('os');
var crypto  = require('crypto');
var fs      = require('fs');
var util    = require('util');

var hyrule = new Object();
hyrule.appName = 'Moblin';
hyrule.appStart = new Date();
hyrule.moblin = new Object();

var moblin = hyrule.moblin;

var zeldaIP = '10.30.0.73';

console.log('['+new Date().toISOString()+'] Welcome to Hyrule.');

fs.readFile('package.json', 'utf8', function(err, data) {
  if (err) throw err;
  var jsonPackage = JSON.parse(data);
  hyrule.version = jsonPackage.version;
  console.log('['+new Date().toISOString()+'] You are '+hyrule.appName+' in Hyrule v'+hyrule.version);
});

fs.readFile('moblin.js', 'utf8', function(err, data) {
  if (err) throw err;
  moblin.md5 = crypto.createHash('md5').update(data).digest('hex');
  console.log('['+new Date().toISOString()+'] MD5: '+moblin.md5);
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
zeldaAgent.maxSockets = 5; // reducing sockets will keep moblin from receiving data fast enough.

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

var zeldaDownload = {
  agent: zeldaAgentVersion,
  host: zeldaIP,
  method: 'GET',
  path: '/moblin.js',
  port: 3000
};


moblin.heartRate = 50;
moblin.EKGRate = 5000;
moblin.versionCheckRate = 5000;
moblin.umbilicalCord = false;
moblin.beatCount = 0;
moblin.eatCount = 0;
moblin.prevBeatCount = 0;
moblin.prevEatCount = 0;
moblin.checkCount = 0;
moblin.prevCheckCount = 0;
moblin.dlCount = 0;
moblin.prevDlCount = 0;
moblin.heartBeatInterval = setInterval(moblinHeartBeat, moblin.heartRate);
moblin.EKGInterval = setInterval(moblinEKG, moblin.EKGRate);
moblin.versionCheckInterval = setInterval(moblinVersionCheck, moblin.versionCheckRate);

function moblinEKG () {
  if (Math.round(moblin.EKGRate/(moblin.beatCount-moblin.prevBeatCount))!=moblin.heartRate||Math.round(moblin.EKGRate/(moblin.eatCount-moblin.prevEatCount))!=moblin.heartRate) {
    console.log('['+new Date().toISOString()+'] Irregular Heartbeat! '+Math.round(moblin.EKGRate/(moblin.beatCount-moblin.prevBeatCount))+' '+Math.round(moblin.EKGRate/(moblin.eatCount-moblin.prevEatCount)));
  }
  moblin.prevBeatCount = moblin.beatCount;
  moblin.prevEatCount = moblin.eatCount;
}

function moblinDownload() {
  moblin.dlCount++;

  if (moblin.dlCount >=50) {
    clearTimeout(moblin.timeoutDownload);
  }

  var downloadRequest = http.request(zeldaDownload, function(res) {
    res.setEncoding('utf8');
    var fNewMoblin = fs.createWriteStream('newmoblin.js');
    res.on('data', function resDownloadData(chunk) {
      fNewMoblin.write(chunk);
    });
    res.on('close', function resDownloadClose(error) {
      console.log(error);
    });
    res.on('end', function resDownloadEnd() {
      fNewMoblin.end();
      handleDownloadFinished();
    });
  });

  downloadRequest.on('error', function downloadRequestError(socketException) {
    handleRequestError(socketException);
    if (!moblin.timeoutDownload) {
      moblin.timeoutDownload = setTimeout(moblinDownload, 1000);
    }
  });

  downloadRequest.end();
}

function handleDownloadFinished(data) {
  fs.readFile('newmoblin.js', 'utf8', function verifyNewMoblin(err, data) {
    if (err) throw err;
    var newMoblinMD5 = crypto.createHash('md5').update(data).digest('hex');
    if (newMoblinMD5 != hyrule.remoteMD5) {
      console.log('['+new Date().toISOString()+'] Problem with download, try again.');
      moblin.timeoutDownload = setTimeout(moblinDownload, 1000);
      return;
    }

    // Probably should do something to make sure we don't fork bomb.
    // Also make sure new version can at least launch and handle tasks.

    fs.rename('newmoblin.js', 'moblin.js', function renameNewMoblin(err) {
      clearInterval(moblin.EKGInterval);
      clearInterval(moblin.heartBeatInterval);
      clearInterval(moblin.versionCheckInterval);

      console.log('['+new Date().toISOString()+'] Updated moblin.js, this process has stopped taking new tasks.');

      if (os.platform()==='win32'){
        var nodeStartHack = spawn('cmd',['/c','start','node','moblin.js']);
      }
    });
  });
}

function moblinVersionCheck () {
  moblin.checkCount++;

  var versionData='';

  var versionRequest = http.request(zeldaVersion, function(res) {
    res.setEncoding('utf8');
    res.on('data', function resVersionData(data) {
      versionData += data;
    });
    res.on('end', function resVersionEnd() {
      handleVersionCheck(versionData);
    });
    res.on('close', function resVersionClose(error) {
      console.log(error);
    });
  });

  versionRequest.on('error', function versionRequestError(socketException) {
    handleRequestError(socketException);
  });

  versionRequest.end();
}

function handleVersionCheck(data) {
  if (!moblin.umbilicalCord) {
    console.log('['+new Date().toISOString()+'] Found Zelda.');
    moblin.umbilicalCord = true;
  }

  var remoteHyrule = JSON.parse(data);

  hyrule.remoteMD5 = remoteHyrule.moblin.md5;

  moblin.prevCheckCount = moblin.checkCount;

  if (remoteHyrule.moblin.md5!=moblin.md5) {
    console.log('['+new Date().toISOString()+'] Zelda says she is in Hyrule v'+remoteHyrule.version);
    console.log('['+new Date().toISOString()+'] Zelda\'s MD5: '+remoteHyrule.moblin.md5);
    console.log('['+new Date().toISOString()+'] Your MD5:    '+moblin.md5);
    console.log('['+new Date().toISOString()+'] Downloading new moblin.js');

    if (!moblin.timeoutDownload) {
      moblin.timeoutDownload = setTimeout(moblinDownload, 1000);
    }
  }
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
    console.log('['+new Date().toISOString()+'] Found Zelda.');
    moblin.umbilicalCord = true;
  }

  if(task.pause && moblin.heartRate != task.pause) {
    console.log('['+new Date().toISOString()+'] Changing heart rate from '+moblin.heartRate+' to '+task.pause+'.');
    moblin.heartRate = task.pause;
    clearInterval(moblin.heartBeatInterval);
    moblin.heartBeatInterval = setInterval(moblinHeartBeat, moblin.heartRate);
  } else if (task.pause) {
    return;
  }
  
  if(task.rdmsr!=null) {
    console.log(tastyBits._id); // Ready to spawn tasks?
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
