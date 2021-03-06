var mongodb = require('mongodb'); // 3rd party node package. We use it for database
var express = require('express'); // 3rd party node package. We use it for web interface
var cluster = require('cluster'); //    Native node package. We use it for multi-threaded socket handling
var crypto  = require('crypto');  //    Native node package. We use it for md5
var fs      = require('fs');      //    Native node package. We use it to read/write files
var net     = require('net');     //    Native node package. We use it for socket interface
var os      = require('os');      //    Native node package. We use it to determine # of CPUs

var hyrule = new Object(); 
hyrule.appName = 'Zelda';
hyrule.appStart = new Date();
hyrule.moblin = new Object();
hyrule.fairy = new Object();
hyrule.config = new Object();

function log(data) {
  console.log('['+new Date().toISOString()+'] '+hyrule.appName+'.'+process.pid+': '+JSON.stringify(data));
}

var configFileDefault = ('./config/default.json');
var configFile = configFileDefault;

if (process.argv[2]) {
  configFile = './config/'+process.argv[2]+'.json';
}

var config;

try {
  config = require(configFile); // This holds our configuration data.
  log('Using '+configFile);
} catch (err) {
  configFile = configFileDefault;
  config = require(configFile);
  log('Using default config.');
}

fs.readFile('./package.json', 'utf8', function(err,data) {
  if (err) throw err;
  var jsonPackage = JSON.parse(data);
  hyrule.version = jsonPackage.version;
  log('I am '+hyrule.appName+' in Hyrule v'+hyrule.version);
});

function showMeTheData() {
//  log("Early Outs: "+cluster.earlyOuts+", Database Hits: "+cluster.dbHits+", Live Workers: "+hyrule.workers.length+", Open Sockets: "+cluster.openSockets);
  cluster.earlyOuts = 0;
  cluster.dbHits = 0;
  var output1 = '';
  var output2 = '';
  for (i=0;i<hyrule.workers.length;i++) {
    var oW = hyrule.workers[i];
    output1 = output1 + ' ' + oW.pid;
    output2 = output2 + ' ' + oW.earlyOuts + ' ' + oW.dbHits + ' ' + oW.sockets.length;
    oW.earlyOuts = 0;
    oW.dbHits = 0;
  }
//  log(output1);
//  log(output2);
}

var newmoblin = '';
var newfairy = '';
var newconfig = '';

function configWatchEvent(exxnt, filename) {
  hyrule.config.watcher.close();
  hyrule.config.watcher = fs.watch(configFile, configWatchEvent);

  if (exxnt==='change') {
    log('config file has been modified.');
  }

  fs.readFile(configFile, 'utf8', function(err,data) {
    if (err) throw err;
    try {
      config = JSON.parse(data);
    } catch (err) {
      log('Error parsing config file.');
    }
    generateMoblinMD5();
    generateFairyMD5();
  });
}

function generateMoblinMD5(exxnt, filename) {
  hyrule.moblin.watcher.close();
  hyrule.moblin.watcher = fs.watch('./moblin.js', generateMoblinMD5);

  if (hyrule.moblin.md5inprogress) {
    return;
  }

  hyrule.moblin.md5inprogress = true;

  if (exxnt==='change') {
    log('moblin.js has been modified.');
  }

  fs.readFile('./moblin.js', 'utf8', function(err,data) {
    if (err) throw err;
    newmoblin = 'var config = new Object();\nconfig.zelda = '+JSON.stringify(config.zelda)+';\n\n'+data;
    hyrule.moblin.md5 = crypto.createHash('md5').update(newmoblin).digest('hex');
    hyrule.moblin.code = newmoblin;
    if (exxnt=="change") {
      for (worker in hyrule.workers) {
        hyrule.workers[worker].send({cmd:"moblinmd5",md5:hyrule.moblin.md5});
        hyrule.workers[worker].send({cmd:"moblincode",code:hyrule.moblin.code});
      }
    }
    log('Moblin MD5: '+hyrule.moblin.md5);
    delete hyrule.moblin.md5inprogress;
  });
}

function generateFairyMD5(exxnt, filename) {
  hyrule.fairy.watcher.close();
  hyrule.fairy.watcher = fs.watch('./fairy.js', generateFairyMD5);

  if (hyrule.fairy.md5inprogress) {
    return;
  }

  hyrule.fairy.md5inprogress = true;

  if (exxnt==='change') {
    log('fairy.js has been modified.');
  }

  fs.readFile('./fairy.js', 'utf8', function(err,data) {
    if (err) throw err;
    newfairy = 'var config = new Object();\nconfig.zelda = '+JSON.stringify(config.zelda)+';\n\n'+data;
    hyrule.fairy.md5 = crypto.createHash('md5').update(newfairy).digest('hex');
    hyrule.fairy.code = newfairy;
    if (exxnt=="change") {
      for (worker in hyrule.workers) {
        hyrule.workers[worker].send({cmd:"fairymd5",md5:hyrule.fairy.md5});
        hyrule.workers[worker].send({cmd:"fairycode",code:hyrule.fairy.code});
      }
    }
    log(' Fairy MD5: '+hyrule.fairy.md5);
    delete hyrule.fairy.md5inprogress;
  });
}

function handleMessageFromWorker(msg) {
  switch (msg.cmd) {
    case "fairycode":
      this.send({cmd:"fairycode",code:hyrule.fairy.code});
      break;
    case "fairymd5":
      this.send({cmd:"fairymd5",md5:hyrule.fairy.md5});
      break;
    case "moblinmd5":
      this.send({cmd:"moblinmd5",md5:hyrule.moblin.md5});
      break;
    case "moblincode":
      this.send({cmd:"moblincode",code:hyrule.moblin.code});
      break;
   case "earlyOut":
      cluster.earlyOuts++;
      this.earlyOuts++;
      break;
    case "dbHit":
      cluster.dbHits++;
      this.dbHits++;
      break;
    case "queryServer":
      break;
    case "connected":
      cluster.openSockets++;
      this.sockets.push(msg.socketid);
      break;
    case "exploded":
      if (this.sockets.indexOf(msg.socketid)==-1) {
        return;
      }
      this.sockets.splice(this.sockets.indexOf(msg.socketid),1);
      cluster.openSockets--;
      break;
    case "closed":
      if (this.sockets.indexOf(msg.socketid)==-1) {
        return;
      }
      this.sockets.splice(this.sockets.indexOf(msg.socketid),1);
      cluster.openSockets--;
      break;
    case "timeouted":
      if (this.sockets.indexOf(msg.socketid)==-1) {
        return;
      }
      this.sockets.splice(this.sockets.indexOf(msg.socketid),1);
      cluster.openSockets--;
      break;
    case "ended":
      if (this.sockets.indexOf(msg.socketid)==-1) {
        return;
      }
      this.sockets.splice(this.sockets.indexOf(msg.socketid),1);
      cluster.openSockets--;
      break;
    case "machineid":
      this.machines[msg.socketid] = msg.machineid;
      break;
    default:
      log(msg + "\n\n message from worker");
  }
}

function handleMasterExit() {
  log("exit event fired.");
  for (worker in hyrule.workers) {
    hyrule.workers[worker].send({cmd:"exit"});
  }
}

function spawnWorkers() {
  while (hyrule.workers.length < os.cpus().length) {
    spawnWorker();
  }
}

function spawnWorker() {
  var worker = cluster.fork();
  hyrule.workers.push(worker);

  worker.earlyOuts = 0;
  worker.dbHits = 0;
  worker.sockets = new Array();
  worker.machines = new Object();
}

function handleWorkerDeath(worker) {
  log('worker '+worker.pid+ ' died.');
  hyrule.workers.splice(hyrule.workers.indexOf(worker),1);
  cluster.openSockets -= worker.sockets.length;
  spawnWorkers();
}

if (cluster.isMaster) { // The master keeps track of the files and the workers.
  hyrule.workers = new Array();
  cluster.earlyOuts = 0;
  cluster.dbHits = 0;
  cluster.openSockets = 0;

  cluster.on('online', function workerOnline(worker) {
    log("worker #"+worker.id+" is online.");
    worker.send({cmd:"fairycode",code:hyrule.fairy.code});
    worker.send({cmd:"fairymd5",md5:hyrule.fairy.md5});
    worker.send({cmd:"moblinmd5",md5:hyrule.moblin.md5});
    worker.send({cmd:"moblincode",code:hyrule.moblin.code});
  });
  
  cluster.on('death', function workerDeath(worker) {
    handleWorkerDeath(worker)
  });

  cluster.on('message', handleMessageFromWorker);

  hyrule.config.watcher = fs.watch(configFile, configWatchEvent);
  hyrule.moblin.watcher = fs.watch('./moblin.js', generateMoblinMD5);
  hyrule.fairy.watcher = fs.watch('./fairy.js', generateFairyMD5);

  generateMoblinMD5('launch', null);
  generateFairyMD5('launch', null);

  spawnWorkers();

  log("I am the master!");

  process.on("exit", handleMasterExit);

  var lovelyDataInterval = setInterval(showMeTheData, 1000);
  return;
}

// Everything below here is for the workers.

process.on("message", handleMessageFromMaster);
process.on("exit", handleWorkerExit);

function handleWorkerExit(data) {
  log(data);
}

log("I am a worker!");

var ObjectID = mongodb.ObjectID;  // This is a native mongodb datatype.
var Timestamp = mongodb.Timestamp; // This is a native mongodb datatype.
var serverHyrule = new mongodb.Server(config.hyrule.host, config.hyrule.port); // This is our database server
var dbHyrule = new mongodb.Db(config.hyrule.database, serverHyrule, {}); // This is our database
var cMachines = new mongodb.Collection(dbHyrule, 'machines');
var cLogs = new mongodb.Collection(dbHyrule, 'logs');

dbHyrule.open(function() {
  var timeDBOpen = new Date();
  log('It took ' + (timeDBOpen.getTime() - hyrule.appStart.getTime()) + 'ms for ' + hyrule.appName + ' to connect to the database.');

//  setTimeout(function chaosMonkey() { log('The chaos monkey sends his regards.'); process.exit(); }, Math.random()*10000);
});

function handleMessageFromMaster(msg) {
  switch (msg.cmd) {
    case "fairymd5":
      hyrule.fairy.md5=msg.md5;
      break;
    case "fairycode":
      hyrule.fairy.code=msg.code;
      break;
    case "moblinmd5":
      hyrule.moblin.md5=msg.md5;
      break;
    case "moblincode":
      hyrule.moblin.code=msg.code;
      break;
    case "exit":
      process.exit();
      break;
    default:
      log(msg + "\n\n message from master.");
  }
}

var defaultPause = 50;
var zeldaExpress = express.createServer();

function Client(mac) {
  var self = this; //You have to do this so you can reference these things later.
  var machine;
  var start = new Date();

  if (mac==undefined) {
    throw new Error('undefined mac');
  }

  this.mac = mac.toLowerCase();
  var findObject = new Object();

  if (self.mac.length==12) {
    self.findObject = {mac:self.mac};
  } else if (self.mac.length==24) {
    self.findObject = {_id:new ObjectID(self.mac)};
  }

  this.taskOut = {task:{pause:defaultPause}}; //,_id:new ObjectID(),created:new Date()}; // This is the default task.

  function getMachines() {
    var currentLastSeen = new Date();
    cMachines.findAndModify(
      self.findObject,
      [],
      {'$set':{'lastseen':currentLastSeen,'alive':true}, '$inc':{'timesseen':1}},
      {'new':false, 'upsert':true, 'fields': {'jobs':{'$slice':5},'jobs.tasks':{'$slice':5},'lastseen':1}},
      function(famErr, famMachine) {
        if (famErr && !famErr.ok) {
          log('Error in findAndModify');
          self.res.json(self.taskOut);
          delete inProgress[self.mac];
          return;
        }

        if (famMachine==null) {
          log('Could not find the machine.');
          self.res.json(self.taskOut);
          delete inProgress[self.mac];
          return;
        }

        self.machine = famMachine;

        var previousLastSeen = self.machine.lastseen ? self.machine.lastseen : currentLastSeen;

        self.machine.lastseen = currentLastSeen;
        self.machine.timesseen++;

// Our actual latency ;)
//log(currentLastSeen.getTime()-previousLastSeen.getTime());

        if (!self.machine.jobs) {
          var updateObject = new Object();
          updateObject['$set'] = new Object();

          self.machine.jobs = new Array();
          updateObject['$set'].jobs = new Array();

          cMachines.update(self.findObject,updateObject,function() {});
        }

// Every request from the client, we need to do up to here. ^^^^^^^^^^^^^
        self.doyourthang();

// And after here. vvvvvvvvvv
     });
  }

  function taskThang() {
    var tStart = self.taskOut;// Our default task.
    var jCount = 0;// This is kind of like our process count.
    var tCount = 0;// This is kind of like our thread count.

    var updateObject = new Object();
    updateObject['$set'] = new Object();

    var uO = updateObject['$set'];// Makes referring to updateObject easier.

    for (job in self.machine.jobs) {
      if (self.machine.jobs[job].locked) {
        break;
      }
      if (self.machine.jobs[job].started) {
        jCount +=1; 
      }
      if (jCount>=2) {
        break;
      }

      var jStart = self.machine.jobs[job];

      if (!jStart.started && jCount<1) {
        var jStarted = new Date();
        var jTimeout = new Date(jStarted.getTime() + jStart.duration);
        jStart.started = jStarted;
        jStart.timeout = jTimeout;

        uO['jobs.'+job+'.started'] = jStarted;
        uO['jobs.'+job+'.timeout'] = jTimeout;

        jCount +=1
      }

      for (task in jStart.tasks) {
        if (jStart.tasks[task].started) {
          tCount +=1 
          break;
        }

        if (tCount>=1) {
          break;
        }

        tStart = jStart.tasks[task];

        tStarted = new Date();
        tTimeout = new Date(tStarted.getTime() + tStart.duration);
        tStart.started = tStarted;
        tStart.timeout = tTimeout;

        uO['jobs.'+job+'.tasks.'+task+'.started'] = tStarted;
        uO['jobs.'+job+'.tasks.'+task+'.timeout'] = tTimeout;

        tCount +=1
      }
    }

    if (tStart != self.taskOut) {
      cMachines.update(self.findObject,updateObject,function(errSave) { // Yay for atomic operations.
        if (errSave) {
          log('errored: ' + JSON.stringify(tStart) + ' ' + new Date());
        } else {
          log('updated: ' + JSON.stringify(updateObject));
        }
      });
    }

    try {
      process.send({cmd:"dbHit"});
    } catch (err) {
      log('error sending dbhit to master.');
      log(err);
      process.exit();
    }
    tStart.ts = self.req.ts;
    self.res.json(tStart); // We're not waiting for the save event to finish.
    delete inProgress[self.mac];

    self.end = new Date();
    // log(self.end - self.start);
  }

  function passThang() {
    var tRemove = -1;
    var jRemove = -1;

    var updateObject = new Object();
    updateObject['$pull'] = new Object();

    var uO = updateObject['$pull'];
    var jobs = self.machine.jobs;

    for (job in jobs) {
      if (!jobs[job].started) { // Dont' bother looking if it hasn't started.
        break;
      }

      if (jobs[job].locked) { // Don't bother looking if it's locked.
        break;
      }

      var jPass;
      jPass = jobs[job];

      for (task in jPass.tasks) {
        if (self.taskID != jPass.tasks[task]._id) {
          continue;
        }

        if (!jPass.tasks[task].started) {
          var now = new Date();
          log('NOT STARTED!!!! ' + JSON.stringify(jPass.tasks[task]) + ' ' + self.start.getTime() + ' ' + now.getTime());
          break;
        }

        var tLog = jPass.tasks[task];
        tLog.machine = self.machine._id;
        tLog.job = jPass._id;
        tLog.completed = new Date();
        delete tLog.timeout;
        delete tLog.duration;
        tLog.local = new Object();
        tLog.local.started = self.req.start;
        tLog.local.completed = self.req.ts;

        dbHyrule.collection('tasks', function(err, collectionTask) {
          collectionTask.insert(tLog);
        });

        uO['jobs.'+job+'.tasks'] = new Object();
        uO['jobs.'+job+'.tasks']._id = tLog._id;

        tRemove = task;
        jRemove = job;
        break;
      }
    }

log(jobs);
    if (tRemove == -1) {
      log("tRemove missing.");
      delete inProgress[self.machine._id];
      return;
    }

    if (jRemove == -1) {
      log("jRemove missing.");
      delete inProgress[self.machine._id];
      return;
    }

    jobs[jRemove].tasks.splice(tRemove,1);

    if (jobs[jRemove].tasks.length==0) {
      jobs[jRemove].machine = self.machine._id;
      jobs[jRemove].completed = new Date();
      delete jobs[jRemove].tasks;
      dbHyrule.collection('jobs', function(err, collectionJob) {
        collectionJob.insert(jobs[jRemove]);
      });

      uO['jobs'] = new Object();
      uO['jobs']._id = jobs[jRemove]._id;

      delete uO['jobs.'+jRemove+'.tasks'];
    }

    log('passed: ' + JSON.stringify(updateObject));

    cMachines.update(self.findObject, updateObject);

    var findLog = new Object();
    findLog._id = new ObjectID(self.taskID);

    var updateLog = new Object();
    updateLog['$set'] = new Object();
    updateLog['$set'].live = false;

    cLogs.update(findLog, updateLog);

    self.res.json({ok:self.req.pass});
    delete inProgress[self.mac];
  }

  function failThang() {
    var tRemove = -1;
    var jRemove = -1;

    var updateObject = new Object();
    updateObject['$pull'] = new Object();

    var uO = updateObject['$pull'];
    var jobs = self.machine.jobs;

    for (job in jobs) {
      if (!jobs[job].started) { // Dont' bother looking if it hasn't started.
        break;
      }

      if (jobs[job].locked) { // Don't bother looking if it's locked.
        break;
      }

      var jFail;
      jFail = jobs[job];

      for (task in jFail.tasks) {
        if (self.taskID != jFail.tasks[task]._id) {
          continue;
        }

        if (!jFail.tasks[task].started) {
          var now = new Date();
          log('NOT STARTED!!!! ' + JSON.stringify(jFail.tasks[task]) + ' ' + self.start.getTime() + ' ' + now.getTime());
          break;
        }

        var tFail = jFail.tasks[task];
        tFail.machine = self.machine._id;
        tFail.job = jFail._id;
        tFail.failed = new Date();
        delete tFail.timeout;
        delete tFail.duration;
        tFail.local = new Object();
        tFail.local.started = self.req.start;
        tFail.local.failed = self.req.ts;

        dbHyrule.collection('tasks', function(err, collectionTask) {
          collectionTask.insert(tFail);
        });

        uO['jobs.'+job+'.tasks'] = new Object();
        uO['jobs.'+job+'.tasks']._id = tFail._id;

        tRemove = task;
        jRemove = job;
        break;
      }
    }

    if (tRemove == -1) {
      return;
    }

    if (jRemove == -1) {
      return;
    }

    jobs[jRemove].tasks.splice(tRemove,1);

    if (jobs[jRemove].tasks.length==0) {
      jobs[jRemove].machine = self.machine._id;
      jobs[jRemove].failed = new Date();
      delete jobs[jRemove].tasks;
      dbHyrule.collection('jobs', function(err, collectionJob) {
        collectionJob.insert(jobs[jRemove]);
      });

      uO['jobs'] = new Object();
      uO['jobs']._id = jobs[jRemove]._id;

      delete uO['jobs.'+jRemove+'.tasks']; //There are no more tasks, so just remove the job.
    }

    log('failed: ' + JSON.stringify(updateObject));

    cMachines.update(self.findObject, updateObject);

    var findLog = new Object();
    findLog._id = new ObjectID(self.taskID);

    var updateLog = new Object();
    updateLog['$set'] = new Object();
    updateLog['$set'].live = false;

    cLogs.update(findLog, updateLog);

    self.res.json({ok:self.req.fail});
    delete inProgress[self.mac];
  }

  function deadThang() {
    var updateMachine = new Object();
    updateMachine['$set'] = new Object();
    updateMachine['$set'].alive = false;
    cMachines.update(self.findObject,updateMachine);

    delete inProgress[self.mac];
  }

  function logThang() {
    var now = new Date();

    var findLog = new Object();
    findLog._id = new ObjectID(self.req.tlog);
    findLog.machine = new ObjectID(self.mac);

    var updateLog = new Object();
    updateLog['$set'] = new Object();
    updateLog['$pushAll'] = new Object();

    var usetLog = updateLog['$set'];
    usetLog.live = true;
    usetLog.lastseen = now.getTime();

    var upushLog = updateLog['$pushAll'];
    upushLog['entries'] = new Array();

    var curTs = self.req.ts;

    while (self.req.data.length>0) {
      var rD = self.req.data.pop();
      var pD;
      try {
        pD = JSON.parse(rD);
      } catch (err) {
        log("error parsing tlog");
      }
      pD.ts = curTs-pD.ts;
      curTs = pD.ts;

      upushLog['entries'].unshift(pD);
    }

    cLogs.update(findLog, updateLog, {upsert: true});
log("logged "+self.req.tlog);    
    delete inProgress[self.mac];
  }

  function task(req, res) {
    self.req = req;
    self.res = res;
    self.start = new Date();
    self.doyourthang = taskThang;
    getMachines();
  }

  function pass(req, res) {
    self.req = req;
    self.res = res;
    self.start = new Date();
    self.taskID = req.pass;
    self.doyourthang = passThang;

    getMachines();
  }

  function fail(req, res) {
    self.req = req;
    self.res = res;
    self.start = new Date();
    self.taskID = req.fail;
    self.doyourthang = failThang;

    getMachines();
  }

  function dead(req, res) {
    self.req = req;
    self.res = res;
    self.start = new Date();

    deadThang();
  }

  function tlog(req, res) {
    self.req = req;
    self.res = res;
    self.start = new Date();
    self.taskID = req.log;
    self.doyourthang = logThang;

    getMachines();
  }

  this.task = task;
  this.pass = pass;
  this.fail = fail;
  this.dead = dead;
  this.tlog = tlog;

  return this;
}

var inProgress = new Object();
var lastOverRun = new Date();

zeldaExpress.get('/:client(client|moblin)/:mac([0-9a-fA-F]{12}|[0-9a-fA-F]{24})/task', function(req, res){
  req.mac = req.params.mac;

  var reqTime = new Date();
  if (inProgress[req.mac]) {
    inProgress[req.mac]++;
    if (inProgress[req.mac] >= 3) {
      lastOverRun = new Date();
    }
    if (inProgress[req.mac] >= 10) {
      log('THE BRAKES!');
      log(inProgress);
      defaultPause +=5;
      inProgress[req.mac] = 1;
    }
    res.json({task:{pause:defaultPause}});
    return;
  }

  if (reqTime.getTime() - lastOverRun.getTime()>1000 && defaultPause > 10) {
    lastOverRun = new Date();
    defaultPause-=5;
  }
  inProgress[req.mac] = new Object();
  inProgress[req.mac] = 1;
  var zCurrent = new Client(req.mac);
  zCurrent.task(req, res);
});

zeldaExpress.post('/:client(client|moblin)/:mac([0-9a-fA-F]{12}|[0-9a-fA-F]{24})/pass/:taskid([0-9a-fA-F]{24})?', function(req, res){
  req.mac = req.params.mac;
  req.pass = req.params.taskid;

  if (inProgress[req.mac]) {
    res.json({task:{pause:defaultPause}});
    overRun++;
    return;
  }
  var zCurrent = new Client(req.mac);
  zCurrent.pass(req, res);
});

zeldaExpress.post('/:client(client|moblin)/:mac([0-9a-fA-F]{12}|[0-9a-fA-F]{24})/fail/:taskid([0-9a-fA-F]{24})?', function(req, res){
  req.mac = req.params.mac;
  req.fail = req.params.taskid;

  if (inProgress[req.mac]) {
    res.json({task:{pause:defaultPause}});
    overRun++;
    return;
  }
  log('got a fail');
  log(req.fail);
  var zCurrent = new Client(req.mac);
  zCurrent.fail(req, res);
});

zeldaExpress.get('/version', function(req,res) {
  var oVersion = new Object();
  oVersion.moblin = new Object();
  oVersion.moblin.md5 = hyrule.moblin.md5;
  oVersion.version = hyrule.version
  res.json(oVersion);
});

zeldaExpress.get('/moblin.js', function(req,res) {
  res.header('Content-Type', 'text/plain');
  res.send(hyrule.moblin.code);
});

zeldaExpress.get('/fairy.js', function(req,res) {
  res.header('Content-Type', 'text/plain');
  res.send(hyrule.fairy.code);
});

zeldaExpress.listen(config.zelda.http.port);

// ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
//  That's web stuff, it's slow
//


//
//  This is socket stuff, it's fast
// vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv

var zelServer = net.createServer(zelOnCreate);
var zelSockID = 0;
var sepChar = String.fromCharCode(3);
var zelSockTimeout = 10000;

function zelOnCreate(zelSock) {
  zelSock.setEncoding('utf8');
  zelSock.setNoDelay(true);
  zelSock.setTimeout(zelSockTimeout);
  zelSock.id = zelSockID++;
  zelSock.data = '';

  zelSock.on('close', zelSockOnClose);
  zelSock.on('connect', zelSockOnConnect);
  zelSock.on('data', zelSockOnData);  
  zelSock.on('end', zelSockOnEnd);
  zelSock.on('error', zelSockOnError);
  zelSock.on('timeout', zelSockOnTimeout);
}

function dowhatnow(context,message) {
  context.socketid = process.pid+'s'+context.id;
//  log(context.socketid+' '+message+'.');
  try {
    process.send({cmd:message,socketid:this.socketid});
  } catch (err) {
    log('error sending message to master.');
    log(err);
    process.exit();
  }
  if (message==="connected") {
    return;
  }
  if (context.mac===undefined) {
    //log(context.socketid+" "+message+" before machineid assigned.");
    return;
  }
  var zCurrent = new Client(context.mac);
  zCurrent.dead();
}

function zelSockOnConnect() {
  dowhatnow(this,"connected");
}

function zelSockOnClose() {
  dowhatnow(this,"closed");
}

function zelSockOnTimeout() {
  dowhatnow(this,"timeouted");
}

var pdTs = 0;

function zelSockOnData(incomingdata) {
  var dTd = new Date();
  var dTs = dTd.getTime();

  //log(dTs-pdTs);
  pdTs = dTs;

  this.data+=incomingdata;

  if (this.data.indexOf(sepChar)<0) {
    return;
  }

  var chunks = this.data.split(sepChar);
  var braked = false;

  for (chunk in chunks) {
    if (chunks[chunk].length==0) {
      continue;
    }

    try {
      var moblinData = JSON.parse(chunks[chunk]);
    } catch (err) {
      log('Error parsing moblin data.');
      log(err);
      return;
    }

    this.send = responseObjectSend;
    this.json = responseObjectJSON;
    if (this.mac == undefined) {
      try {
        process.send({cmd:"machineid",machineid:moblinData.mac,socketid:this.socketid});
      } catch (err) {
        log('error sending machineid to master.');
        log(err);
        process.exit();
      }
    }
    this.mac  = moblinData.mac;
    
    var reqTime = new Date();
    var reqTS = reqTime.getTime();

    if (inProgress[moblinData.mac] && !moblinData.pass && !moblinData.fail && !moblinData.log) {
      var pO = inProgress[moblinData.mac];
      inProgress[moblinData.mac].push(moblinData.ts);
      if (inProgress[moblinData.mac].length >= 5) {
        lastOverRun = new Date();
      }
      if (inProgress[moblinData.mac].length >= 10 && !braked) {
        log('THE BRAKES!');
        log(inProgress);
        defaultPause +=5;
        braked=true;
      }
      try {
        process.send({cmd:"earlyOut"});
      } catch (err) {
        log('error sending earlyOut to master.');
        log(err);
        process.exit();
      }
      this.json({task:{pause:defaultPause},ts:moblinData.ts,early:true});
      continue;
    }

    prevMob = moblinData.mac;

    if (reqTime.getTime() - lastOverRun.getTime()>1000 && defaultPause > 15) {
      lastOverRun = new Date();
      defaultPause-=5;
    }

    if (moblinData.mac==undefined || moblinData.ts==undefined) {
      log(moblinData);
    }

    inProgress[moblinData.mac] = new Array();
    inProgress[moblinData.mac].push(moblinData.ts);

    var zCurrent = new Client(moblinData.mac);
    if (moblinData.pass) {
      zCurrent.pass(moblinData, this);
    } else if (moblinData.fail) {
      zCurrent.fail(moblinData, this);
    } else if (moblinData.tlog) {
      zCurrent.tlog(moblinData, this);
    } else {
      zCurrent.task(moblinData,this);
    }
  }
  this.data = '';
}
 
function responseObjectSend(out) {
  if (this.destroyed||this.readyState=='closed') {
    //log('zelSock'+this.id+' is dead.');
    return;
  }
  
  try {
    this.write(out+String.fromCharCode(3));
  } catch (err) {
    //Socket closed.
  }
}

function responseObjectJSON(out) {
  var output = JSON.stringify(out)
  if (this.destroyed||this.readyState=='closed') {
    //log('zelSock'+this.id+' is dead.');
    return;
  }
  try {
    this.write(output+String.fromCharCode(3));
  } catch (err) {
    // Our socket closed.
  }
}

function zelSockOnEnd() {
//  dowhatnow(this,"ended");
}

function zelSockOnError(socketException) {
//  dowhatnow(this,"exploded");
  handleSocketError(socketException);
}

zelServer.listen(config.zelda.socket.port, function zeldaSocketListen() {
  log('ZeldaSocket is listening on port '+config.zelda.socket.port+'.');
});

function handleSocketError(socketException) {
  switch(socketException.code) {
    case 'ECONNRESET':
      //log('A moblin crashed.');
      break;
    case 'ECONNREFUSED':
      log('Try to repro this lol.');
      break;
    case 'EPIPE':
      //log('Socket closed before write.'); // handled already.
      break;
    default:
      log(socketException);
  }
}
