var mongodb = require('mongodb');
var express = require('express');
var io      = require('socket.io');
var util    = require('util');

var hyrule = new Object();
hyrule.appName = 'Link';
hyrule.appStart = new Date();
hyrule.config = new Object();

var configFileDefault = ('./config/default.json');
var configFile = configFileDefault;

if (process.argv[2]) {
  var whichfile = process.argv[2].split('--')
  configFile = './config/'+whichfile.pop()+'.json';
}

var config;

try {
  config = require(configFile); // This holds our configuration data.
  log('Using '+configFile);
} catch (err) {
  config = require(configFileDefault);
  log('Using default config.');
}

var ObjectID = mongodb.ObjectID;

var serverHorcrux = new mongodb.Server(config.hyrule.host, config.hyrule.port);
var dbHyrule = new mongodb.Db(config.hyrule.database, serverHorcrux, {});

function log(data) {
  console.log('['+new Date().toISOString()+'] '+hyrule.appName+'.'+process.pid+': '+util.inspect(data));
}

dbHyrule.open(function() {
  log('Welcome to Hyrule.');
  var timeDBOpen = new Date();
  log('It took ' + (timeDBOpen.getTime() - hyrule.appStart.getTime()) + 'ms for ' + hyrule.appName + ' to connect to the database.');
});

var dbMachines = dbHyrule.collection('machines');

log('Hello, my name is ' + hyrule.appName + '!');

var link = express.createServer();

io = io.listen(link);
io.set('log level', 1);

link.listen(config.link.http.port);

var defaultFrequency = 500; 
var socketClients = new Object();

io.sockets.on('connection', socketsOnConnection);

function socketsOnConnection(socket) {
  log('Client '+socket.id+' connected.');
  socketClients[socket.id] = new Object();
  socket.on('disconnect', socketOnDisconnect);
  socket.on('dashstart', socketOnDashStart);
  socket.on('rdmsrstart', socketOnRdmsrStart);
}

function socketOnDisconnect() {
  log('Client '+this.id+' disconnected.');
  if (!socketClients[this.id]) {
    return;
  }
  clearInterval(socketClients[this.id].socketInterval);
  delete socketClients[this.id];
}

function socketOnDashStart() {
  log('Client '+this.id+' requested dashstart.');
  socketClients[this.id].liveMachines = new Object();
  socketClients[this.id].deltaMachines = new Object();
  socketClients[this.id].liveMachines.length = 0;
  socketClients[this.id].frequency = defaultFrequency;
  socketClients[this.id].socketInterval = setInterval(dashPush, defaultFrequency, this);
}

var dashInProgress = new Object();

function dashPush(dSocket) {
  if (dashInProgress[dSocket.id]) {
    return;
  }

  var pStart = new Date();
  dashInProgress[dSocket.id] = pStart.getTime();

  var secondsago = 10;
  var thispointintime = new Date(pStart.getTime()-secondsago*1000);

  var dashCurrent = socketClients[dSocket.id];

  var findObject = new Object();
  findObject['$or'] = new Array();
  findObject['$or'].push({alive:true});
  findObject['$or'].push({lastseen:{'$gt':thispointintime}});

  dbMachines.find(findObject,{timesseen:1, alive:1}).toArray( function(errFind, rMachines) {
    if (!dashCurrent) { // Don't do anything if socket is already closed.
      return;
    }

    var liveTimesseen = 0;
    var prevTimesseen = 0;

    for (rMachine in rMachines) {
      var cMachine = rMachines[rMachine];
      if (cMachine.alive) {
        if (dashCurrent.liveMachines[cMachine._id]) {
          prevTimesseen += dashCurrent.liveMachines[cMachine._id];
        } else {
          dashCurrent.liveMachines.length++;
        }
        dashCurrent.deltaMachines[cMachine._id] = cMachine.timesseen-dashCurrent.liveMachines[cMachine._id];
        dashCurrent.liveMachines[cMachine._id] = cMachine.timesseen;
        liveTimesseen += cMachine.timesseen;
      } else {
        if (dashCurrent.liveMachines[cMachine._id]) {
          delete dashCurrent.liveMachines[cMachine._id];
          delete dashCurrent.deltaMachines[cMachine._id];
          dashCurrent.liveMachines.length--;
        }
      }
    }

    var pMid = new Date();
    var output = new Object();

    output.liveMachines = dashCurrent.liveMachines.length;
    output.deltaMachines = dashCurrent.deltaMachines;
    output.dashElapsed = pMid.getTime()-dashCurrent.prevPush;
    if (prevTimesseen) {
      output.deltaLive = liveTimesseen - prevTimesseen;
      output.updatesPerSecond = Math.floor(output.deltaLive * 1000 / output.dashElapsed);
      output.usecPerClient = Math.floor(1000000 / output.updatesPerSecond / output.liveMachines);
    } else {
      output.deltaLive = 0;
      output.updatesPerSecond = 0;
      output.msPerClient = 0;
    }
    var pEnd = new Date();
    log((pEnd.getTime()-pStart.getTime())+' '+(pMid.getTime()-pStart.getTime()));

    dSocket.emit('dash', output);

    dashCurrent.prevPush = dashInProgress[dSocket.id];

    delete dashInProgress[dSocket.id];
  });
}

function socketOnRdmsrStart() {
  if (!socketClients[this.id]) {
    return;
  }
  socketClients[this.id] = {'prevData':0};
  socketClients[this.id].socketInterval = setInterval( function() {
    if (socketClients[this.id]) {
      dbHyrule.collection('tasks', function(errCollection, collectionTasks) {
        collectionTasks.find({'task.rdmsr':{'$ne':null}}).sort({completed:-1}).limit(3).toArray( function(errFind, rTasks) { // index on completed.
          if (socketClients[this.id]) {
            var output = '';
            for (task in rTasks) {
              output += JSON.stringify(rTasks[task]) + ' ';
            }
            if (socketClients[this.id].prevData!=output) {
              socket.emit('rdmsr', output);
            }
            link.socketClients[this.id].prevData = output;
          }
        });
      });
    }
  }, link.defaultFrequency);
  createRdmsrPollingJob(data);
}

link.get('/machines', function(req, res){
  dbHyrule.collection('machines', function(errCollection, collectionMachine, callback) {
    collectionMachine.find().sort({_id:-1}).limit(50).toArray( function(errFind, results) {
      var output = '';
      output += '<h1>Machines</h1>\r\n'; 
      output += '<div id="banana"> </div>\r\n';
      for (result in results) {
        var mResult = results[result];
        output += '<a href="/machine/' + mResult._id + '">' + mResult._id + '</a>';
        if (mResult.mac) {
          output += ' ' + mResult.mac;
        }
        output += ' ' + mResult.timesseen;
        output += ' ' + mResult.lastseen;
        output += ' <a href="/machine/' +mResult._id + '/createjob">add a job</a>';
        output += '<br />\r\n';
      }
      res.send(output);
    });
  });
});

link.get('/job/:jobid([0-9a-fA-F]{24})/retry', function(req, res) {
  var jObjectID = new ObjectID(req.params.jobid);
  dbHyrule.collection('machines', function(eCollection, cMachines) {
    cMachines.findAndModify(
        {jobs:{'$elemMatch':{_id:jObjectID}}},
        [],
        {'$unset' : {'jobs.$.started':1,'jobs.$.timeout':1}, '$set':{'jobs.$.locked':true}}, //we lock this so clients don't get this while we're updating.
        function (eUpdate, rUpdate) {
          var jUpdate;
          for (job in rUpdate.jobs){
            if (rUpdate.jobs[job]._id == req.params.jobid) {
              jUpdate = rUpdate.jobs[job];
            }
          }
          for (task in jUpdate.tasks) {
            delete jUpdate.tasks[task].started;
            delete jUpdate.tasks[task].timeout;
          }
          cMachines.update({jobs:{'$elemMatch':{_id:jObjectID}}}, {'$set':{'jobs.$.tasks':jUpdate.tasks}, '$unset':{'jobs.$.locked':1}}, function(eee, rrr) {
            res.send('ok');
          });
    });
  });
});

link.get('/machine/:machine([0-9a-fA-F]{12}|[0-9a-fA-F]{24})', function(req, res) {
  var findObject;
  if (req.params.machine.length==12) {
    findObject = {mac:req.params.machine};
  } else if (req.params.machine.length==24) {
    var mObjectID = new ObjectID(req.params.machine);
    findObject = {_id:mObjectID};
  }
  dbHyrule.collection('machines', function(cError, cMachines) {
    cMachines.findOne(findObject, function(fError, fResult) {
      res.send(fResult);
    });
  });
});

link.get('/machine/:machine([0-9a-fA-F]{12}|[0-9a-fA-F]{24})/jobs', function(req, res) {
        dbHyrule.collection('machines', function(cError, cMachines) {
                var findObject;
                if (req.params.machine.length==12) {
                        findObject = {mac:req.params.machine};
                } else if (req.params.machine.length==24) {
                        var mObjectID = new ObjectID(req.params.machine);
                        findObject = {_id:mObjectID};
                }
                cMachines.findOne(findObject, {jobs:1}, function(fError, fResult) {
                        if(fResult) {
        res.send(fResult);
      } else {
                                res.send('failed to find machine.\n');
                        }
                });
        });
});

function removeRdmsrPollingJob(rdmsrObject) {

}

function createRdmsrPollingJob(rdmsrObject) {
  dbHyrule.collection('machines', function(cError, cMachines) {
    for (machine in rdmsrObject.machines) {

      var findObject;

      if (machine.length==12) {
        findObject = {mac:machine};
      } else if (machine.length==24) {
        var mObjectID = new ObjectID(machine);
        findObject = {_id:mObjectID};
      }

      var jPoll = new Object();
      jPoll._id = new ObjectID();
      jPoll.created = new Date();
      jPoll.tasks = new Array();
      jPoll.duration = 10000;
      jPoll.poll = 100;

      for(msr in rdmsrObject.machines[machine].msrs) {
        var tPoll = new Object();
        tPoll._id = new ObjectID();
        tPoll.created = new Date();
        tPoll.duration = 1000;
        tPoll.poll = 100;
        tPoll.task = new Object();
        tPoll.task.rdmsr = new Object();
        tPoll.task.rdmsr[msr] = rdmsrObject.machines[machine].msrs[msr];
        jPoll.tasks.push(tPoll);
      }

      cMachines.findAndModify( // we use findAndModify because of its atomic operation, otherwise we could lose data.
      findObject,
      [],
      {'$push':{'jobs':jPoll}},
      {new:true},
      function(fError, fResult) {
        //log(fResult);
      });
    }
  });
}

link.get('/machine/:machine([0-9a-fA-F]{12}|[0-9a-fA-F]{24})/rdmsr/:msr([0-9a-fA-F]+)/:affinity([0-9a-fA-F]+)?', function(req, res, next) {
  if (req.params.msr.length>4) {
    next();
  }

  var output = '';
  output += '<script src="http://code.jquery.com/jquery-1.7.1.min.js"></script>\r\n';
  output += '<script src="/socket.io/socket.io.js"></script>\r\n';
  output += '<script type="text/javascript">\r\n';
  output += 'var socket = io.connect();\r\n';
  output += 'var hope;\r\n';

  var mTest = new Array();
  mTest = [req.params.machine];

  var MSRs = new Object();
  MSRs.machines = new Object();
  for (m in mTest) {
    mT = mTest[m];
    MSRs.machines[mT] = new Object();
    MSRs.machines[mT].msrs = new Object();
    MSRs.machines[mT].msrs[req.params.msr] = req.params.affinity;
    for (var jj=0;jj<=100;jj++) {
      MSRs.machines[mT].msrs[jj] = jj;
    }
  }
  output += 'socket.emit(\'rdmsrstart\', ' + JSON.stringify(MSRs) + ');\r\n';
  output += 'socket.on(\'rdmsr\', function (data) {\r\n';
  output += 'hope = data;\r\n';
  output += '$(\'#banana\').html(\'<p>\'+JSON.stringify(data)+\'</p>\\r\\n\');\r\n';
  output += '});\r\n';
  output += '</script>\r\n';
  output += '<h1>rdmsr ' + req.params.msr + '</h1>\r\n';
  output += '<div id="banana"> </div>\r\n';

  res.send(output);
});

link.get('/machine/:machine([0-9a-fA-F]{12}|[0-9a-fA-F]{24})/createjob', function(req, res) {
  dbHyrule.collection('machines', function(cError, cMachines) {
    var findObject;
    if (req.params.machine.length==12) {
      findObject = {mac:req.params.machine};
    } else if (req.params.machine.length==24) {
      var mObjectID = new ObjectID(req.params.machine);
      findObject = {_id:mObjectID};
    }
    cMachines.findOne(findObject, function(fError, fResult) {
      if(fResult) {
        var jPoll = new Object();
        jPoll._id = new ObjectID();
        jPoll.created = new Date();
        jPoll.tasks = new Array();
        jPoll.duration = 110000;
        fResult.jobs.push(jPoll);
        for(var n=1;n<=10;n++) {
          var tPoll = new Object();
          tPoll._id = new ObjectID();
          tPoll.created = new Date();
          tPoll.duration = 2000;
          tPoll.task = {execpass:"c:\\pollmsr.exe 1486"};
          fResult.jobs[fResult.jobs.length-1].tasks.push(tPoll);
        }
        cMachines.save(fResult, {}, function(err,callback){ // this is dangerous, we could lose data.
          if(err && !err.ok) {
            res.send('failed to create.\n');
          } else {
            res.send(JSON.stringify(jPoll));
          }
        });
      } else {
        res.send('failed to find machine.\n');
      }
    });
  });
});

link.get('/job/:jobid([0-9a-fA-F]{24})', function(req, res) {
  var jObjectID = new ObjectID(req.params.jobid);
  dbHyrule.collection('jobs', function(cError, cJobs) {
    cJobs.findOne({_id:jObjectID}, function(fError, fResult) {
      res.send(fResult);
    });
  });
});

link.get('/task/:taskid([0-9a-fA-F]{24})', function(req, res) {
  var tObjectID = new ObjectID(req.params.taskid);
  dbHyrule.collection('tasks', function(cError, cTasks) {
    cTasks.findOne({_id:tObjectID}, function(fError, fResult) {
      res.send(fResult);
    });
  });
});

link.get('/inprogress', function(req, res){
  dbHyrule.collection('machines', function(cError, cMachines, callback) {
    cMachines.find({'$or':[{'jobs.started':{'$ne':null}},{'jobs.tasks.started':{'$ne':null}}]}).sort({lastseen:-1}).toArray( function(errFind, results) {
      var output = '';
      output += '<h1>In Progress</h1>\r\n';
      for (result in results) {
        var mResult = results[result];
        output += mResult.mac + ' ';
        for (job in mResult.jobs) {
          var jResult = mResult.jobs[job];
          output += 'Job: ';
          output += jResult.started;
          output += ' <a href="/job/' + jResult._id + '/retry">retry</a>';
          output += '<br />\r\n';
          for (task in jResult.tasks) {
            var tResult = jResult.tasks[task];
            if (tResult.started) {
              output += 'Task: ';
              output += JSON.stringify(tResult.task) + ' ';
              output += tResult.started + '<br />\r\n';
            }
          }
        }
        output += '<br />\r\n';
      }
      res.send(output);
    });
  });
});

link.get('/tasks', function(req, res){
  dbHyrule.collection('tasks', function(cError, cTasks, callback) {
    cTasks.find().sort({started:-1}).limit(50).toArray( function(errFind, results) {
      var output = '';
      output += '<h1>Last 50 Tasks</h1>\r\n';
      for (result in results) {
        var tResult = results[result];
        output += '<a href="/task/' + tResult._id + '">' + tResult._id + '</a>';
        output += ' ' + tResult.machine + ' ' + tResult.started + ' ' + JSON.stringify(tResult.task) + ' ' + (tResult.completed - tResult.started) + '<br />\r\n';
      }
      res.send(output);
    });
  });
});

link.get('/jobs', function(req, res){
  dbHyrule.collection('jobs', function(errCollection, collectionJobs, callback) {
    collectionJobs.find().sort({started:-1}).limit(50).toArray( function(errFind, results) {
      var output = '';
      output += '<h1>Last 50 Jobs</h1>\r\n';
      for (result in results) {
        var jResult = results[result];
        output += '<a href="/job/' + jResult._id + '">' + jResult._id + '</a>';
        output += ' ' + jResult.machine + ' ' + jResult.started + ' ' + (jResult.completed - jResult.started) + '<br />\r\n';
      }
      res.send(output);
    });
  });
});

link.get('/', function(req, res){
  res.sendfile('./templates/index.html');
});

link.get('/version', function(req,res) {
  fs.readFile('package.json', 'utf8', function(err,data) {
  if (err) throw err;
    var jsonPackage = JSON.parse(data);
    link.version = jsonPackage.version;
    res.send(link.version);
  });
});
