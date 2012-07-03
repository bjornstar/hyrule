var crypto = require("crypto");
var http   = require("http");
var net    = require("net");
var os     = require("os");
var spawn  = require("child_process").spawn;

//process.on("message", handleParentMessage);
process.on("exit", handleProcessOnExit);

var defaultConfig = new Object();
defaultConfig.zelda = new Object();
defaultConfig.zelda.http = {host:"localhost", port:3000};
defaultConfig.zelda.socket = {host:"localhost", port:3003};

// Here's how this works, your copy of moblin should have been downloaded from Zelda.
// It should be tailored specifically for the Zelda that you got it from.
// If you don't have a specially designed moblin, you'll get the defaults.

if (config===undefined) {
  var config = defaultConfig;
}

var hyrule = new Object();
hyrule.appName = "Moblin";
hyrule.appStart = new Date();
hyrule.moblin = new Object();
hyrule.tasks = new Object();

function log(data){
  console.log("["+new Date().toISOString()+"] "+hyrule.appName+"_"+moblin.name+": "+JSON.stringify(data));
}

var moblin = hyrule.moblin;
var intInc = 0; // This is for creating ObjectIDs.

moblin.name = generateObjectId();

function handleProcessOnExit(code) {
  // This gets run when the moblin is told to exit, not when it crashes.
  // The fairy needs to track tasks pids.
  for (task in hyrule.tasks) {
    hyrule.tasks(task).kill("SIGTERM");
  }
  if (this.send) {
    this.send({moblin:"I died.", code:code});
  }
}

function handleParentMessage(m) {
  switch(m.fairy) {
    case "Hold on a sec.":
      //clearInterval(moblin.httpHeartBeatInterval);
      clearInterval(mobSockWriteInterval);
      delete mobSockWriteInterval;
      clearInterval(moblin.EKGInterval);
      delete moblin.EKGInterval;
      break;
    case "Goodbye.":
      process.exit();
      break;
    case "OK, keep going.":
      //moblin.httpHeartBeatInterval = setInterval(moblinHttpHeartBeat, moblin.heartRate);
      mobSockWriteInterval = setInterval(mobSockWrite, moblin.heartRate);
      moblin.EKGInterval = setInterval(moblinEKG, moblin.EKGRate);
      break;
    default:
      log(m.fairy);
  }
}

function generateObjectId() {
  var nameNew = "";
  var timePortion = parseInt(new Date().getTime().toString().substr(0,10)).toString(16);
  nameNew += timePortion;

  var hostPortion = crypto.createHash("md5").update(os.hostname()).digest("hex").substr(0,6);
  nameNew += hostPortion;

  var processPortion = process.pid.toString(16).substr(0,4);
  while (processPortion.length<4) {
    processPortion = "0"+processPortion;
  }
  nameNew += processPortion;

  intInc++;
  var incPortion = parseInt(intInc).toString(16).substr(0,6);
  while (incPortion.length<6) {
    incPortion = "0"+incPortion;
  }
  nameNew += incPortion;

  return nameNew;
}

var zeldaTask = {
  host: config.zelda.http.host,
  method: "GET",
  path: "/moblin/"+moblin.name+"/task",
  port: config.zelda.http.port
};

function handleSocketError(socketException) {
  switch(socketException.code) {
    case "ECONNRESET":
      if (moblin.umbilicalCord) {
        //log("I saw Zelda die.");
        moblin.umbilicalCord = false;
        setHeartRate(moblin.heartRateDisconnected);
      }
      break;
    case "ECONNREFUSED":
      if (moblin.umbilicalCord) {
        log("I can not find Zelda.");
        moblin.umbilicalCord = false;
        setHeartRate(moblin.heartRateDisconnected);
      }
      break;
    case "EADDRNOTAVAIL":
      log("Gotta reset the socket.");
      if (moblin.umbilicalCord) {
        moblin.umbilicalCord = false;
        setHeartRate(moblin.heartRateDisconnected);
      }
      break;
    default:
      log(socketException);
  }
}

moblin.heartRate = 50;
moblin.heartRateDisconnected = 1000;
moblin.EKGRate = 5000;
moblin.EKGFreePass = true;
moblin.umbilicalCord = false;
moblin.beatCount = 0;
moblin.eatCount = 0;
moblin.prevBeatCount = 0;
moblin.prevEatCount = 0;
moblin.prevBytesRead = 0;
moblin.prevBytesWritten = 0;
//moblin.httpHeartBeatInterval = setInterval(moblinHttpHeartBeat, moblin.heartRate);
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
    //log("Irregular Heartbeat! "+Math.round(moblin.EKGRate/(moblin.beatCount-moblin.prevBeatCount))+" "+Math.round(moblin.EKGRate/(moblin.eatCount-moblin.prevEatCount)));
  }
  if (mobSock.bytesRead>=moblin.prevBytesRead) {
    //log(((mobSock.bytesRead-moblin.prevBytesRead)/(moblin.EKGRate/1000))+' '+((mobSock.bytesWritten-moblin.prevBytesWritten)/(moblin.EKGRate/1000)));
  }
  moblin.prevBytesRead = mobSock.bytesRead;
  moblin.prevBytesWritten = mobSock.bytesWritten;
  moblin.prevBeatCount = moblin.beatCount;
  moblin.prevEatCount = moblin.eatCount;
  moblin.EKGFreePass = false;
}

function setHeartRate(newRate) {
  if (moblin.heartRate===newRate) {
    return;
  }

  //log("Changing heartrate from "+moblin.heartRate+" to "+newRate);

  var oldRate = moblin.heartRate;
  moblin.heartRate = newRate;
//  clearInterval(moblin.httpHeartBeatInterval);
  clearInterval(mobSockWriteInterval);
//  moblin.httpHeartBeatInterval = setInterval(moblinHttpHeartBeat, moblin.heartRate+4990);
  mobSockWriteInterval = setInterval(mobSockWrite, moblin.heartRate);
  moblin.EKGFreePass = true;
}

function moblinHttpHeartBeat () {
  moblin.beatCount++;

  var taskData = "";
  var taskStart = new Date();

  var taskRequest = http.get(zeldaTask, function(res) {
    res.setEncoding("utf8");
    res.on("data", function resTaskData(data) {
      taskData += data;
    });
    res.on("end", function resTaskEnd() {
      digestTask(taskData, taskStart);
    });
    res.on("close", function resTaskClose(error) {
      log(error);
    });
  });

  taskRequest.on("error", handleSocketError);
}

function digestTask(chunk, taskStart) {
  moblin.eatCount++;

  var tastyBits = new Object();

  try {
    tastyBits = JSON.parse(chunk);
  } catch (err) {
    log(err);
    log(chunk);
    return;
  }

  if (tastyBits.ok) { // We need to figure out how to handle pass/fail here.
    log(tastyBits);
    return;
  }

  var task = tastyBits.task;

  if (!moblin.umbilicalCord) {
    log("I found Zelda.");
    moblin.umbilicalCord = true;
  }

  if(moblin.eatCount===1) {
    if (process.send) {
      log("I handled my first task.");
      process.send({moblin:"I handled my first task."});
    }
  }

  var taskEnd = new Date();
  var ooo = '';
  ooo = taskEnd.getTime()-tastyBits.ts+'';
  if (tastyBits.early) {
    ooo = '*   '+ooo;
  }
  //log(ooo);
  //log((taskEnd-taskStart)+' '+task.pause);

  if(task.pause && moblin.heartRate != task.pause) {
    setHeartRate(task.pause);
    return;
  } else if (task.pause) {
    return;
  }
  
  if(task.execpass) {
    log(tastyBits); // Ready to spawn tasks?
    var commandLine = task.execpass.split(' ');
    var moblinTask = spawn(commandLine.shift(), commandLine);
    moblinTask.task = tastyBits;
    moblinTask.task.data = '';
    if (moblinTask.task.timeoutpass || moblinTask.task.timeoutfail) {
      moblinTask.certainDeath = setTimeout(timeToDie, moblinTask.task.duration, moblinTask.task._id);
      var deathTime = new Date(taskEnd.getTime() + moblinTask.task.duration);
      moblinTask.deathts = deathTime.getTime();
    }
    moblinTask.stdout.parent = moblinTask;
    moblinTask.stderr.parent = moblinTask;
    moblinTask.stdout.on("data", moblinTaskData);
    moblinTask.stderr.on("data", moblinTaskErr);
    moblinTask.on("exit", moblinTaskExit);

    hyrule.tasks[moblinTask.task._id]=moblinTask;
  }
}

function timeToDie(taskID) {
  var endTime = new Date();
  log(taskID+"'s time is up!");
  dyingTask = hyrule.tasks[taskID];
  // Might want to do a sanity check to make sure duration and everything is done right (ie. timer fired early).
  log(endTime.getTime() - dyingTask.deathts);
  if (dyingTask.task.passkill || dyingTask.task.failkill) {
    dyingTask.kill('SIGTERM'); // Killing it will trigger a pass or fail message.
  } else if (dyingTask.task.timeoutpass) {
    mobSockWrite({mac:moblin.name,pass:this.task._id,start:this.task.ts,ts:endTime.getTime()});
  } else if (dyingTask.task.timeoutfail) {
    mobSockWrite({mac:moblin.name,fail:this.task._id,start:this.task.ts,ts:endTime.getTime()});
  } else {
    log("Time is up, but no instructions on how to proceed.");
  }
}

function moblinTaskData(data) {
  var logTime = new Date();
  this.parent.task.data += data.toString();
  var tempData = this.parent.task.data.split("\r\n");
  this.parent.task.data = tempData.pop();

  if (!tempData.length) {
    return;
  }

  var outData = {mac:moblin.name,tlog:this.parent.task._id,data:tempData,ts:logTime.getTime()};

  for(rD in tempData) {
    var pD;
    try {
      pD = JSON.parse(tempData[rD]);
    } catch (err) {
      log("error parsing data.");
    }
//    log(pD);
  }

  mobSockWrite(outData);
}

function moblinTaskErr(data) {
  log("task."+this.parent.task._id+"  err: "+data.length);
}

function moblinTaskExit(code) {
  log("task."+this.task._id+": exited with code "+code);
  var endTime = new Date();
  if (code==0 || (code==null && this.task.timeoutpass)) {
    log("PASSING THIS TASK YAY!");
    log("It took " + (endTime.getTime() - this.task.ts) + "ms to complete.");
    mobSockWrite({mac:moblin.name,pass:this.task._id,start:this.task.ts,ts:endTime.getTime()});
  } else {
    log("FAILING THIS TASK BOO!");
    mobSockWrite({mac:moblin.name,fail:this.task._id,code:code,start:this.task.ts,ts:endTime.getTime()});
  }
  clearTimeout(this.certainDeath);
  delete hyrule.tasks[this.task._id];
}

var mobSock;
var mobSockWriteInterval;
var mobSockConnectInterval;
var mobSockID = 0;
var mobSockData = "";
var mobSockTimeout = 10000;

mobSockCreate();

function mobSockCreate() {
  if (mobSock&&mobSock.readyState=="opening") {
    return;
  }  

  mobSock = new net.Socket();
  mobSock.id = mobSockID++;
  mobSock.on("close", mobSockOnClose);
  mobSock.on("data", mobSockOnData);
  mobSock.on("timeout", mobSockOnTimeout);
  mobSock.on("error", mobSockOnError);

  mobSock.setTimeout(mobSockTimeout);

  mobSock.connect(config.zelda.socket.port, config.zelda.socket.host, mobSockOnConnect);
  log("Created mobSock"+mobSock.id+".");
}

function mobSockOnTimeout() {
  //log("This socket has timed out.");
  mobSock.end();
}

function mobSockOnClose(had_error) {
  log("mobSock"+mobSock.id+" closed.");
  if (mobSockWriteInterval) {
    clearInterval(mobSockWriteInterval);
    delete mobSockWriteInterval;
  }
  if (mobSockConnectInterval && mobSockConnectInterval.ontimeout!=null) {
    return;
  }
  mobSockConnectInterval = setInterval(mobSockCreate, 100);
}

function mobSockOnConnect() {
  //log("mobSock"+mobSock.id+" connected.");
  if (mobSockConnectInterval) {
    clearInterval(mobSockConnectInterval);
    delete mobSockConnectInterval;
  }
  if (mobSockWriteInterval && mobSockWriteInterval.ontimeout!=null) {
    return;
  }
  mobSockWriteInterval = setInterval(mobSockWrite, moblin.heartRate);
}

function mobSockOnData(data) {
  moblin.beatCount++;
  mobSockData += data;
  moblin.umbilicalCord = true;
  if (mobSockData.lastIndexOf(String.fromCharCode(3))!=mobSockData.length-1) {
    return;
  }
  var dataStart = new Date();
  var chunks = mobSockData.split(String.fromCharCode(3));
  for (chunk in chunks) {
    if (chunks[chunk].length==0) {
      continue;
    }
    digestTask(chunks[chunk], dataStart);
  }
  mobSockData = "";
}

function mobSockOnError(error) {
  handleSocketError(error);
}

var ls = 0;
var earlyCount = 0;
var lateCount = 0;

setInterval(function() {
  if (process.send) {
    process.send({cmd:"stats",stats:{early:earlyCount,late:lateCount}});
  }
  //log('Actual: '+Math.round(500/lateCount)+' Early: '+earlyCount);
  earlyCount = 0;
  lateCount = 0;
}, 500);

function mobSockWrite(data) {
  var td = new Date();
  var ts = td.getTime();

  if (ts-ls<moblin.heartRate*0.8 && !data) {
    // Node timers on Windows fire early. We let them fire 20% early, otherwise it's a bit much. They can try again.
    earlyCount++;
    return;
  }

  lateCount++;

  ls = ts;

  if (mobSock.destroyed||mobSock.readyState=="closed") {
    //log("mobSock"+mobSock.id+" is dead.");
    return;
  }

  if (!data) {
    data = {mac:moblin.name,ts:ts};
  }

  var output = JSON.stringify(data)+String.fromCharCode(3);

  try {
    mobSock.write(output);
  } catch (err) {
    log(err);
  }
}


