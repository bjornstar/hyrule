var crypto = require('crypto');
var http   = require('http');
var net    = require('net');
var os     = require('os');
var spawn  = require('child_process').spawn;

var hyrule = new Object();
hyrule.appName = 'Moblin';
hyrule.appStart = new Date();
hyrule.moblin = new Object();

function log(data){
  console.log('['+new Date().toISOString()+'] Moblin.'+process.pid+': '+data);
}

var moblin = hyrule.moblin;
var zeldaIP = '10.30.0.73';
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
      clearInterval(moblin.httpHeartBeatInterval);
      clearInterval(moblin.socketHeartBeatInterval);
      clearInterval(moblin.EKGInterval);
      break;
    case 'Goodbye.':
      process.exit();
      break;
    case 'OK, keep going.':
      moblin.httpHeartBeatInterval = setInterval(moblinHttpHeartBeat, moblin.heartRate);
      moblin.socketHeartBeatInterval = setInterval(moblinSocketHeartBeat, moblin.heartRate);
      moblin.EKGInterval = setInterval(moblinEKG, moblin.EKGRate);
      break;
    default:
      log(m.fairy);
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

log('Welcome to Hyrule.');
log('I dub thee moblin_'+moblin.name+'.');

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
  host: zeldaIP,
  method: 'GET',
  path: '/moblin.js',
  port: 3000
};

moblin.heartRate = 50;
moblin.heartRateDisconnected = 1000;
moblin.EKGRate = 5000;
moblin.EKGFreePass = true;
moblin.umbilicalCord = false;
moblin.beatCount = 0;
moblin.eatCount = 0;
moblin.prevBeatCount = 0;
moblin.prevEatCount = 0;
moblin.httpHeartBeatInterval = setInterval(moblinHttpHeartBeat, moblin.heartRate);
moblin.socketHeartBeatInterval = setInterval(moblinSocketHeartBeat, moblin.heartRate);
moblin.EKGInterval = setInterval(moblinEKG, moblin.EKGRate);

function moblinEKG () {
  var heartOK = false;
  if (!heartOK && Math.round(moblin.EKGRate/(moblin.beatCount-moblin.prevBeatCount))==moblin.heartRate) {
    heartOK = true;
  }
  if (heartOK && Math.round(moblin.EKGRate/(moblin.eatCount-moblin.prevEatCount))==moblin.heartRate) {
    heartOK = true;
  }
  if (heartOK && moblin.eatCount-moblin.prevEatCount==0) {
    heartOK = true;
  }
  if (!heartOK && !moblin.EKGFreePass) {
    log('Irregular Heartbeat! '+Math.round(moblin.EKGRate/(moblin.beatCount-moblin.prevBeatCount))+' '+Math.round(moblin.EKGRate/(moblin.eatCount-moblin.prevEatCount)));
  }
  moblin.prevBeatCount = moblin.beatCount;
  moblin.prevEatCount = moblin.eatCount;
  moblin.EKGFreePass = false;
}

function setHeartRate(newRate) {
  if (moblin.heartRate===newRate) {
    return;
  }

  log('Changing Heartrate from '+moblin.heartRate+' to '+newRate);

  var oldRate = moblin.heartRate;
  moblin.heartRate = newRate;
  clearInterval(moblin.httpHeartBeatInterval);
  clearInterval(moblin.socketHeartBeatInterval);
  moblin.httpHeartBeatInterval = setInterval(moblinHttpHeartBeat, moblin.heartRate+4990);
  moblin.socketHeartBeatInterval = setInterval(moblinSocketHeartBeat, moblin.heartRate);
  moblin.EKGFreePass = true;
}

function moblinHttpHeartBeat () {
  moblin.beatCount++;

  var taskData = ''
  var taskStart = new Date();

  var taskRequest = http.request(zeldaTask, function(res) {
    res.setEncoding('utf8');
    res.on('data', function resTaskData(data) {
      taskData += data;
    });
    res.on('end', function resTaskEnd() {
      digestTask(taskData, taskStart);
    });
    res.on('close', function resTaskClose(error) {
      log(error);
    });
  });

  taskRequest.on('error', function taskRequestError(socketException) {
    handleSocketError(socketException);
  });

  taskRequest.end();
}

function digestTask(chunk, taskStart) {
  moblin.eatCount++;

  if (chunk.length>21) {
    log('invalid json '+chunk);
    return;
  }

  var tastyBits = JSON.parse(chunk);
  var task = tastyBits.task;

  if (!moblin.umbilicalCord) {
    log('I found Zelda.');
    moblin.umbilicalCord = true;
  }

  if(moblin.eatCount===1) {
    if (process.send) {
      process.send({moblin:'I handled my first task.'});
   }
  }

  var taskEnd = new Date();
  log((taskEnd-taskStart)+' '+task.pause);

  if(task.pause && moblin.heartRate != task.pause) {
    setHeartRate(task.pause);
    return;
  } else if (task.pause) {
    return;
  }
  
  if(task.rdmsr!=null) {
    log(tastyBits._id); // Ready to spawn tasks?
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

var moblinSocket = new net.Socket();

moblinSocket.connect(3003, zeldaIP, function moblinSocketConnect() {
  moblinSocket.once('error', function moblinSocketError(socketException) {
    log('socketError');
    log(require('util').inspect(moblinSocket));
    handleSocketError(socketException);
  });
  moblinSocket.setEncoding('utf8');
  moblinSocket.setNoDelay(true);

  var moblinData = '';
  moblinSocket.on('data', function moblinSocketData(data) {
    moblinData += data;
    moblin.umbilicalCord = true;
    if (moblinData.lastIndexOf(String.fromCharCode(3))!=moblinData.length-1) {
      return;
    }
var dataStart = new Date();
    var chunks = moblinData.split(String.fromCharCode(3));
    for (chunk in chunks) {
      if (chunks[chunk].length==0) {
        continue;
      }
      digestTask(chunks[chunk], dataStart);
    }
    moblinData = '';
  });

  moblinSocket.on('end', function moblinSocketEnd() {
    log('Disconnected from Zelda.');
  });

  moblinSocket.on('close', function moblinSocketClose(had_error) {
    //log('socket closed. had_error='+had_error);
  });
});


function moblinSocketHeartBeat() {
  moblin.beatCount++;

  var output = JSON.stringify({params:{mac:moblin.name}});
  if (moblinSocket.destroyed) {
    moblinSocket.connect(); /*3003, zeldaIP, function moblinSocketReconnect() {
      moblinSocket.once('error', function moblinSocketReconnectError(socketException) {
        log('reconnect Error');
        handleSocketError(socketException);
      });
    });*/
    return;
  }
  if (moblinSocket.bufferSize>0) {
    return;
  }
  moblinSocket.write(output);
  moblinSocket.write(String.fromCharCode(3));
}

function handleSocketError(socketException) {
  switch(socketException.code) {
    case 'ECONNRESET':
      if (moblin.umbilicalCord) {
        log('I saw Zelda die.');
        moblin.umbilicalCord = false;
        setHeartRate(moblin.heartRateDisconnected);
      }
      break;
    case 'ECONNREFUSED':
      if (moblin.umbilicalCord) {
        log('I can\'t find Zelda.');
        moblin.umbilicalCord = false;
        setHeartRate(moblin.heartRateDisconnected);
      }
      break;
    default:
      log(socketException);
  }
}

