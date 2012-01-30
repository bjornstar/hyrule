var mongodb = require('mongodb'); // 3rd party node package. We use it for database
var express = require('express'); // 3rd party node package. We use it for web interface
var cluster = require('cluster'); //    Native node package. We use it for multi-threaded socket handling
var crypto  = require('crypto');  //    Native node package. We use it for md5
var fs      = require('fs');      //    Native node package. We use it to read/write files
var net     = require('net');     //    Native node package. We use it for socket interface
var os      = require('os');      //    Native node package. We use it to determine # of CPUs
var util    = require('util');    //    Native node package. We use it for logging

var hyrule = new Object(); 
hyrule.appName = 'Zelda';
hyrule.appStart = new Date();
hyrule.moblin = new Object();
hyrule.fairy = new Object();
hyrule.config = new Object();

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
  config = require(configFileDefault);
  log('Using default config.');
}

var ObjectID = mongodb.ObjectID;  // This is a Mongo BSON datatype.

var serverHyrule = new mongodb.Server(config.hyrule.host, config.hyrule.port); // This is our database server
var dbHyrule = new mongodb.Db(config.hyrule.database, serverHyrule, {}); // This is our database
var cMachines = new mongodb.Collection(dbHyrule, 'machines');

function log(data) {
  console.log('['+new Date().toISOString()+'] '+hyrule.appName+'.'+process.pid+': '+util.inspect(data));
}

hyrule.workers = new Array();
cluster.earlyOuts = 0;
cluster.dbHits = 0;
cluster.openSockets = 0;

function showMeTheData() {
  log("Early Outs: "+cluster.earlyOuts+", Database Hits: "+cluster.dbHits+", Live Workers: "+hyrule.workers.length+", Open Sockets: "+cluster.openSockets);
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
  log(output1);
  log(output2);
}

if (cluster.isMaster) {
  for (var i = 0;i < os.cpus().length; i++) {
    var worker = cluster.fork();

    hyrule.workers.push(worker);
    worker.earlyOuts = 0;
    worker.dbHits = 0;
    worker.sockets = new Array();

    worker.on('message', function (msg) {
      if (msg.connected!=null) {
        cluster.openSockets++;
        this.sockets.push(msg.connected);
        return;
      }
      if (msg.closed!=null) {
        if (this.sockets.indexOf(msg.closed)==-1) {
          return;
        }
        this.sockets.splice(this.sockets.indexOf(msg.closed),1);
        cluster.openSockets--;
        return;
      }
      if (msg.timeouted!=null) {
        if (this.sockets.indexOf(msg.timeouted)==-1) {
          return;
        }
        this.sockets.splice(this.sockets.indexOf(msg.timeouted),1);
        cluster.openSockets--;
        return;
      }
      switch (msg.jsonOut) {
        case 'earlyOut':
          cluster.earlyOuts++;
          this.earlyOuts++;
          break;
        case 'dbHit':
          cluster.dbHits++;
          this.dbHits++;
          break;
        default:
          //log(msg);
      }
    });

    worker.on('death', function(worker) {
      log('worker '+worker.pid+ ' died.');
    });
  }


  var lovelyDataInterval = setInterval(showMeTheData, 1000);
} else {

  dbHyrule.open(function() {
    log('Welcome to Hyrule.');
    var timeDBOpen = new Date();
    log('It took ' + (timeDBOpen.getTime() - hyrule.appStart.getTime()) + 'ms for ' + hyrule.appName + ' to connect to the database.');
  });

fs.readFile('./package.json', 'utf8', function(err,data) {
  if (err) throw err;
  var jsonPackage = JSON.parse(data);
  hyrule.version = jsonPackage.version;
  log('You are '+hyrule.appName+' in Hyrule v'+hyrule.version);
});

hyrule.config.watcher = fs.watch(configFile, configWatchEvent);
hyrule.moblin.watcher = fs.watch('./moblin.js', generateMoblinMD5);
hyrule.fairy.watcher = fs.watch('./fairy.js', generateFairyMD5);

var newmoblin = '';
var newfairy = '';

function configWatchEvent(exxnt, filename) {
  log(exxnt);
  log(hyrule.moblin.md5inprogress);
  if (exxnt==='rename') {
    return;
  }
  if (exxnt==='change') {
    log('config file has been modified.');
  }
  generateMoblinMD5();
  generateFairyMD5();
}

function generateMoblinMD5(exxnt, filename) {
  if (exxnt==='rename') {
    return;
  }
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
    log('Moblin MD5: '+hyrule.moblin.md5);
    delete hyrule.moblin.md5inprogress;
  });
}

function generateFairyMD5(exxnt, filename) {
  if (exxnt==='rename') {
    return;
  }
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
    log(' Fairy MD5: '+hyrule.fairy.md5);
    delete hyrule.fairy.md5inprogress;
  });
}

generateMoblinMD5('launch', null);
generateFairyMD5('launch', null);

var defaultPause = 50;
var zeldaExpress = express.createServer();

function Client(mac) {
  var self = this; //You have to do this so you can reference these things later.
  var machine;
  var start = new Date();

  this.mac = mac.toLowerCase();
  var findObject = new Object();

  if (self.mac.length==12) {
    self.findObject = {mac:self.mac};
  } else if (self.mac.length==24) {
    self.findObject = {_id:new ObjectID(self.mac)};
  }

  this.taskOut = {task:{pause:defaultPause}}; //,_id:new ObjectID(),created:new Date()}; // This is the default task.

  function getMachines() {
  cMachines.findAndModify(
    self.findObject,
    [],
    {'$set':{'lastseen':new Date(),'alive':true}, '$inc':{'timesseen':1}},
    {'new':false, 'upsert':true, 'fields': {'jobs':{'$slice':5},'jobs.tasks':{'$slice':5},'created':1}},
    function(famErr, famMachine) {
    if (famErr && !famErr.ok) {
      log('Error in findAndModify');
      self.res.json(self.taskOut);
      delete inProgress[self.req.params.mac];
      return;
    }
    if (famMachine==null) {
      log('Could not find the machine.');
      self.res.json(self.taskOut);
      delete inProgress[self.req.params.mac];
      return;
    }
    self.machine = famMachine;
    if (!self.machine.created || !self.machine.jobs) {
      if (!self.machine.created) {
        self.machine.created = new Date();
      }
      if (!self.machine.jobs) {
        self.machine.jobs = new Array();
      }
      cMachines.update(self.findObject,{'$set':{'created':new Date(),'jobs':new Array()}},function() {});
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
        var jStarted = new Date()
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
				//	log('updated: ' + JSON.stringify(tStart) + ' ' + self.start.getTime() + ' ' + now.getTime());
				}
			});
		}
                process.send({jsonOut:'dbHit'});
tStart.ts = self.req.params.ts;
		self.res.json(tStart); // We're not waiting for the save event to finish.
		delete inProgress[self.req.params.mac];

		self.end = new Date();
//		log(self.end - self.start);
	}

	function passThang() {
		var jPass;
		var tRemove = -1;

		var updateObject = new Object();
		updateObject['$pull'] = new Object();

		var uO = updateObject['$pull'];

		for (job in self.machine.jobs) {
			if (!self.machine.jobs[job].started) { // Dont' bother looking if it hasn't started.
				break;
			}

			if (self.machine.jobs[job].locked) { // Don't bother looking if it's locked.
				break;
			}

			jPass = self.machine.jobs[job];
			jRemove = job;

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

				dbHyrule.collection('tasks', function(err, collectionTask) {
					collectionTask.insert(tLog);
				});

				uO['jobs.'+job+'.tasks'] = new Object();
				uO['jobs.'+job+'.tasks']._id = new ObjectID(tLog._id);

				tRemove = task;
			}
		}

		if (tRemove == -1) {
			return;
		}

		jPass.tasks.splice(tRemove,1);

		if (jPass.tasks.length==0) {
			var jLog = self.machine.jobs.splice(jRemove,1);
			jLog.machine = self.machine._id;
			jLog.completed = new Date();
			delete jLog.tasks;
			dbHyrule.collection('jobs', function(err, collectionJob) {
				collectionJob.insert(jLog);
			});

			uO['jobs'] = new Object();
			uO['jobs']._id = new ObjectID(jLog._id);
		}

		cMachines.update(self.findObject, updateObject, function(err,callback){ // it's atomic!
			if (err && !err.ok) {
				appendError({'errorData':err,'errorin':'updating machine on pass.'});
				self.res.send('not ok.');
			} else {
				self.res.send('ok'); // Here we wait until save completes before responding.
				delete inProgress[self.req.params.mac];
			}
		});
	}

	function failThang() {
		dbHyrule.collection('tasks', function(err, collectionTask) {
			if (self.machine.jobs.length && self.machine.jobs[0].started && !self.machine.jobs[0].locked) { // don't pass if locked.
				if (self.machine.jobs[0].tasks.length && self.machine.jobs[0].tasks[0].started) {
					var taskDone = new Object();
					taskDone = self.machine.jobs[0].tasks.shift();
					taskDone.machine = self.machine._id;
					taskDone.job = self.machine.jobs[0]._id;
					taskDone.completed = new Date();
					collectionTask.insert(taskDone);
					if (self.machine.jobs[0].tasks.length==0) {
						var jobDone = new Object();
						jobDone = self.machine.jobs.shift();
						jobDone.machine = self.machine._id;
						jobDone.completed = new Date();
						jobDone.fail = true;
						delete jobDone.tasks;
						dbHyrule.collection('jobs', function(err, collectionJob) {
							collectionJob.insert(jobDone);
						});
					}
					cMachines.save(self.machine, {}, function(err,callback){
						if (err && !err.ok) {
							appendError({'errorData':err,'errorin':'updating machine on pass.'});
							self.res.send('not ok.\n');
						} else {
							self.res.send('ok\n');
						}
					});
				} else {
					log('no tasks to pass.');
					self.res.send('no tasks to pass.');
				}
			} else if (self.machine.jobs[0].locked) {
				log('job is locked!');
				self.res.send('locked.');
			} else {
				log('no jobs to pass.');
				self.res.send('no jobs to pass.');
			}
		});
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
    self.taskID = req.params.taskid;
    self.doyourthang = passThang;

    getMachines();
  }

  function fail(req, res) {
    self.req = req;
    self.res = res;
    self.start = new Date();
    self.taskID = req.params.taskid;
    self.doyourthang = failThang;

    getMachines();
  }

  this.task = task;
  this.pass = pass;
  this.fail = fail;

  return this;
}

var inProgress = new Object();
var lastOverRun = new Date();

zeldaExpress.get('/:client(client|moblin)/:mac([0-9a-fA-F]{12}|[0-9a-fA-F]{24})/task', function(req, res){
	var reqTime = new Date();
	if (inProgress[req.params.mac]) {
		inProgress[req.params.mac]++;
		if (inProgress[req.params.mac] >= 3) {
			lastOverRun = new Date();
		}
		if (inProgress[req.params.mac] >= 10) {
			log('THE BRAKES!');
			log(inProgress);
			defaultPause +=5;
			inProgress[req.params.mac] = 1;
		}
		res.json({task:{pause:defaultPause}});
		return;
	}

	if (reqTime.getTime() - lastOverRun.getTime()>1000 && defaultPause > 10) {
		lastOverRun = new Date();
		defaultPause-=5;
	}
	inProgress[req.params.mac] = new Object();
	inProgress[req.params.mac] = 1;
	var zCurrent = new Client(req.params.mac);
	zCurrent.task(req, res);
});

zeldaExpress.post('/:client(client|moblin)/:mac([0-9a-fA-F]{12}|[0-9a-fA-F]{24})/pass/:taskid([0-9a-fA-F]{24})?', function(req, res){
	if (inProgress[req.params.mac]) {
		res.json({task:{pause:defaultPause}});
		overRun++;
		return;
	}
	var zCurrent = new Client(req.params.mac);
	zCurrent.pass(req, res);
});

zeldaExpress.post('/:client(client|moblin)/:mac([0-9a-fA-F]{12}|[0-9a-fA-F]{24})/fail/:taskid([0-9a-fA-F]{24})?', function(req, res){
	if (inProgress[req.params.mac]) {
		res.json({task:{pause:defaultPause}});
		overRun++;
		return;
	}
	log('got a fail');
	log(req.params.taskid);
	var zCurrent = new Client(req.params.mac);
	zCurrent.fail(req, res);
});

zeldaExpress.get('/version', function(req,res) {
  res.send(hyrule);
});

zeldaExpress.get('/moblin.js', function(req,res) {
  res.header('Content-Type', 'text/plain');
  res.send(newmoblin);
});

zeldaExpress.get('/fairy.js', function(req,res) {
  res.header('Content-Type', 'text/plain');
  res.send(newfairy);
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

function zelSockOnConnect() {
  process.send({connected:process.pid+'s'+this.id});
}

function zelSockOnClose() {
  process.send({closed:process.pid+'s'+this.id});
}

function zelSockOnTimeout() {
  process.send({timeouted:process.pid+'s'+this.id});
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
  var defaultTask = "{\"task\":{\"pause\":\""+defaultPause+"\"},\"early\":true}";
  var braked = false;

  for (chunk in chunks) {
    if (chunks[chunk].length==0) {
      continue;
    }

    try {
      var moblinData = JSON.parse(chunks[chunk]);
    } catch (err) {
      log(err);
      return;
    }

    this.send = responseObjectSend;
    this.json = responseObjectJSON;
    
    var reqTime = new Date();
    var reqTS = reqTime.getTime();

    if (inProgress[moblinData.params.mac]) {
      var pO = inProgress[moblinData.params.mac];
      inProgress[moblinData.params.mac].push(moblinData.params.ts);
      if (inProgress[moblinData.params.mac].length >= 5) {
        lastOverRun = new Date();
      }
      if (inProgress[moblinData.params.mac].length >= 10 && !braked) {
        log('THE BRAKES!');
        log(inProgress);
        defaultPause +=5;
        braked=true;
      }
      process.send({jsonOut:'earlyOut'});
      this.json({task:{pause:defaultPause},ts:moblinData.params.ts,early:true});
      continue;
    }

    prevMob = moblinData.params.mac;

    if (reqTime.getTime() - lastOverRun.getTime()>1000 && defaultPause > 15) {
      lastOverRun = new Date();
      defaultPause-=5;
    }

    inProgress[moblinData.params.mac] = new Array();
    inProgress[moblinData.params.mac].push(moblinData.params.ts);

    var zCurrent = new Client(moblinData.params.mac);
    zCurrent.task(moblinData,this);
  }
  this.data = '';
}
 
function responseObjectSend(out) {
  if (this.destroyed||this.readyState=='closed') {
    log('zelSock'+this.id+' is dead.');
    return;
  }
  
  try {
    this.write(out);
    this.write(String.fromCharCode(3));
  } catch (err) {
    //Socket closed.
  }
}

function responseObjectJSON(out) {
  var output = JSON.stringify(out)
  if (this.destroyed||this.readyState=='closed') {
    log('zelSock'+this.id+' is dead.');
    return;
  }
  try {
    this.write(output);
    this.write(String.fromCharCode(3));
  } catch (err) {
    // Our socket closed.
  }
}

function zelSockOnEnd() {
  log('A moblin disconnected.');
}

function zelSockOnError(socketException) {
  handleSocketError(socketException);
}

zelServer.listen(config.zelda.socket.port, function zeldaSocketListen() {
  log('ZeldaSocket is listening on port '+config.zelda.socket.port+'.');
});

function handleSocketError(socketException) {
  switch(socketException.code) {
    case 'ECONNRESET':
      log('A moblin crashed.');
      break;
    case 'ECONNREFUSED':
      log('Try to repro this lol.');
      break;
    default:
      log(socketException);
  }
}

}
