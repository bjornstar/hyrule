var cluster = require("cluster");
var crypto  = require("crypto");
var fork    = require("child_process").fork;
var fs      = require("fs");
var http    = require("http");
var net     = require("net");
var os      = require("os");
var spawn   = require("child_process").spawn;
var util    = require("util");
var vm      = require("vm");

var defaultConfig = new Object();
defaultConfig.zelda = new Object();
defaultConfig.zelda.http = {"host":"localhost","port":3000};

if (config===undefined) {
  var config = defaultConfig;
}

var hyrule = new Object();
hyrule.appName = "Fairy";
hyrule.appStart = new Date();
hyrule.moblin = new Object();
hyrule.moblins = new Object();
hyrule.fairy = new Object();
hyrule.fairies = new Array();
hyrule.fairy.config = new Object();
hyrule.fairy.config.useVM = true;
hyrule.fairy.config.useFile = false;

var parallelMoblins = 1;
var outofdate = false;
 
hyrule.zeldaDownloadMoblin = {
  host: config.zelda.http.host,
  method: "GET",
  path: "/moblin.js",
  port: config.zelda.http.port
};

hyrule.zeldaVersion = {
  host: config.zelda.http.host,
  method: "GET",
  path: "/version",
  port: config.zelda.http.port
};

if (process.argv[2]&&process.argv[2].match(/^\d+$/g)>0) {
  parallelMoblins = parseInt(process.argv[2]);
}

function log(data) {
  console.log("["+new Date().toISOString()+"] "+hyrule.appName+"."+process.pid+": "+util.inspect(data));
}

if (cluster.isMaster) { // The master keeps an eye on who is running what. It doesn't run a moblin.
  fs.readFile("fairy.js", "utf8", handleReadFairy);
  fs.readFile("moblin.js", "utf8", handleReadMoblin);

//  spawnFairies();

  cluster.on('death', handleFairyDeath); //define this once for the cluster.

  hyrule.fairy.versionCheckRate = 1000;
  hyrule.fairy.versionCheckInterval = setInterval(moblinVersionCheck, hyrule.fairy.versionCheckRate);

  hyrule.fairy.statsDelay = 1000;
  hyrule.fairy.statsInterval = setInterval(fairyStats, hyrule.fairy.statsDelay);
} else { // These fairies will spawn moblins at the behest of the master.
  var contextMoblin = new Object(); // Each moblin will inherit these from the parent fairy.
  contextMoblin.clearInterval = clearInterval;
  contextMoblin.console = console;
  contextMoblin.process = process;
  contextMoblin.require = require;
  contextMoblin.setInterval = setInterval;

  process.on("message", handleMessageFairy);
  try {
    process.send({cmd:"Give me a moblin"}); 
  } catch (err) {
    log(err);
    process.exit();
  }
//  setTimeout(function chaosMonkey() { log('The chaos monkey sends his regards.'); process.exit();}, Math.round(Math.random()*10000));
}

function handleMessageMaster(data) {
  switch (data.cmd) {
    case 'online':
      //log('fairy.'+this.pid+' was born.');
      break;
    case "Give me a moblin":
      try {
        this.md5 = hyrule.moblin.md5;
        this.send({moblin:{code:hyrule.moblin.code,script:hyrule.moblin.script,md5:hyrule.moblin.md5}});
      } catch (err) {
        log(err);
        process.exit();
      }
      break;
    case "stats":
      this.earlyCount += data.stats.early;
      this.lateCount += data.stats.late;
      break;
    default:
      if (data.moblin=="I handled my first task.") {
        this.moblinOnline = true;
        dothefairycheck();
        if (!hyrule.fairy.versionCheckInterval) {
          hyrule.fairy.versionCheckInterval = setInterval(moblinVersionCheck, hyrule.fairy.versionCheckRate);
        }
        break;
      }
      if (data.moblin=="I died.") {
        break;
      }
      log(this.pid+' '+data);
  }
}

function dothefairycheck() {
  if (hyrule.fairies.length<parallelMoblins) {
    spawnFairies();
  }

  var liveFairies = 0;
  for (f in hyrule.fairies) {
    if (hyrule.fairies[f].md5==hyrule.validMD5 & liveFairies<parallelMoblins) {
      liveFairies++;
      continue;
    }
    try {
      hyrule.fairies[f].send({cmd:"die"});
      liveFairies--;
    } catch (err) {
      log(err);
      process.exit();
    }
  }
}

function spawnFairies() {
  while (hyrule.fairies.length<parallelMoblins) {
    spawnFairy();
  }
}

function spawnFairy() {
  var fairy = cluster.fork();
  fairy.earlyCount = 0;
  fairy.lateCount = 1;
  hyrule.fairies.push(fairy);
  fairy.on("message", handleMessageMaster);
}
    
function handleMessageFairy(data) {
  if (data.moblin) {
    this.moblin = data.moblin;
    if (data.moblin.code) {
      log(this.moblin.md5);
      this.moblin.script = vm.createScript(data.moblin.code, "moblin.js");
      this.moblin.script.runInNewContext(contextMoblin);
    }
    return;
  }
  switch (data.cmd) {
    case "die":
      process.exit();
      break;
    default:
      log(this.pid+' '+data.cmd);
  }
}

function handleFairyDeath(fairy) {
  hyrule.fairies.splice(hyrule.fairies.indexOf(fairy), 1);
  spawnFairies();
}

function handleReadFairy(err, data) {
  if (err) throw err;
  hyrule.fairy.md5 = crypto.createHash("md5").update(data).digest("hex");
  log(" Fairy MD5: "+hyrule.fairy.md5);
  hyrule.fairy.code = data;
}

function handleReadMoblin(err, data) {
  if (err) {
    log("Cannot find moblin.js, will download from Zelda.");
    outofdate = true;
    return;
  }

  hyrule.moblin.md5 = crypto.createHash("md5").update(data).digest("hex");
  log("Moblin MD5: "+hyrule.moblin.md5);
  hyrule.moblin.code = data;
  hyrule.moblin.script = vm.createScript(data, "moblin.js");
  log(vm.createScript(data, "moblin.js"));
}

function spawnMoblin() {
  log("Spawning a moblin.");
  var newMoblin = fork("moblin.js");

  log("Moblin."+newMoblin.pid+" launched.");

  process.on("exit", function () {
    try {
      newMoblin.send({fairy:"Goodbye."});
    } catch (err) {
      log(err);
      process.exit();
    }
  });

  newMoblin.md5 = hyrule.moblin.md5;
  newMoblin.on("message", handleMoblinMessage);
  newMoblin.on("exit", handleMoblinExit);
  newMoblin.earlyCount = 0;
  newMoblin.lateCount = 1;
  newMoblin.readyState = "starting";
  hyrule.moblins[newMoblin.pid] = newMoblin;
}

function handleMoblinExit(code, signal) {
  log("Moblin."+this.pid+" exited with code "+code);
}

function moblinVersionCheck () {
  var versionData="";

  var versionRequest = http.request(hyrule.zeldaVersion, function(res) {
    versionRequest.on("error", handleSocketError);
    res.setEncoding("utf8");
    res.on("data", function resVersionData(data) {
      versionData += data;
    });
    res.on("end", function resVersionEnd() {
      handleVersionCheck(versionData);
    });
    res.on("close", function resVersionClose(error) {
      log(error);
    });
  });

  versionRequest.on("error", handleSocketError);
  versionRequest.end();
}


function handleVersionCheck(data) {
  if (!hyrule.fairy.umbilicalCord) {
    log("I found Zelda.");
    hyrule.fairy.umbilicalCord = true;
  }

  var remoteHyrule = JSON.parse(data);

  if (hyrule.remoteMD5==remoteHyrule.moblin.md5) {
    return;
  }

  hyrule.remoteMD5 = remoteHyrule.moblin.md5;
  hyrule.fairy.readyState = "downloading";
  log("Zelda says she is in Hyrule v"+remoteHyrule.version);
  log("Remote MD5: "+remoteHyrule.moblin.md5);
  log("Downloading new moblin.js");

  hyrule.fairy.timeoutDownload = setTimeout(moblinDownload, 50);
}

function moblinDownload() {
  delete hyrule.fairy.timeoutDownload;

  var downloadRequest = http.request(hyrule.zeldaDownloadMoblin, function(res) {
    downloadRequest.on("error", function downloadRequestError(socketException) {
      handleSocketError(socketException);
      if (!hyrule.fairy.timeoutDownload) {
        hyrule.fairy.timeoutDownload = setTimeout(moblinDownload, 1000);
      }
    });

    res.setEncoding("utf8");
    var vNewMoblin = '';
    res.on("data", function resDownloadData(chunk) {
      vNewMoblin = vNewMoblin + chunk;
    });
    res.on("close", function resDownloadClose(error) {
      console.log(error);
    });
    res.on("end", function resDownloadEnd() {
      handleDownloadEnd(vNewMoblin);
    });
  });

  downloadRequest.on("error", function downloadRequestError(socketException) {
    log("downloadRequestError");
    handleSocketError(socketException);
    if (!hyrule.fairy.timeoutDownload) {
      hyrule.fairy.timeoutDownload = setTimeout(moblinDownload, 1000);
    }
  });

  downloadRequest.end();
}

function handleDownloadEnd(downloadedMoblin) {
  if (!hyrule.fairy.umbilicalCord) {
    log("Found Zelda.");
    hyrule.fairy.umbilicalCord = true;
  }

  try {
    fs.writeFile("newmoblin.js", downloadedMoblin);
  } catch (err) {
    log(err);
    log("Couldn't write new moblin.");
  }
 
  hyrule.moblin.md5 = crypto.createHash("md5").update(downloadedMoblin).digest("hex");
  hyrule.moblin.code = downloadedMoblin;

  try {
    hyrule.moblin.script = vm.createScript(downloadedMoblin);
    hyrule.validMD5 = hyrule.moblin.md5;
  } catch (err) {
    log("Bad moblin.");
  }
  
  if (hyrule.validMD5 != hyrule.moblin.md5) {
    hyrule.moblin.code = "";
    hyrule.moblin.md5 = "";
    return;
  }

  clearInterval(hyrule.fairy.versionCheckInterval);
  delete hyrule.fairy.versionCheckInterval;

  if (hyrule.fairies.length<=parallelMoblins) {
    spawnFairy();
  }
}

function handleMoblinMessage(m) {
  if (!hyrule.fairy.versionCheckInterval) {
    hyrule.fairy.versionCheckInterval = setInterval(moblinVersionCheck, hyrule.fairy.versionCheckRate);
  }
  if (m.early) {
    this.earlyCount+=m.early;
  }
  if (m.late) {
    this.lateCount+=m.late;
  }
  if (!m.moblin) {
    return;
  }
  switch (m.moblin) {
    case "I died.":
      delete hyrule.moblins[this.pid]; 
      break;
    case "I handled my first task.":
      log('ding ding ding!!!!!');
      if (hyrule.remoteMD5==undefined) {
        hyrule.fairy.readyState = "running";
        this.readyState = "running";
        log("Moblin."+this.pid+" handled its first task.");
        return;
      }

      if (hyrule.fairy.readyState=="verifying") {
        hyrule.fairy.readyState = "running";
        this.readyState = "running";

        log("Moblin."+this.pid+" is verified to be running properly.");

        fs.rename("newmoblin.js", "moblin.js", function renameNewMoblin(err) {
          if (err) {
            return;
          }

          for (moblinPID in hyrule.moblins) {
            var oldMoblin = hyrule.moblins[moblinPID];
            if (oldMoblin.stdin && !oldMoblin.stdin.destroyed && oldMoblin.readyState=="paused") {
              oldMoblin.send({fairy:"Goodbye."});
            }
          }

          if (!hyrule.fairy.versionCheckInterval) {
            hyrule.fairy.versionCheckInterval = setInterval(moblinVersionCheck, hyrule.fairy.versionCheckRate);
          }
          clearTimeout(hyrule.fairy.timeoutStartup);
          delete hyrule.fairy.timeoutStartup;
        });
        return;
      }

      if (this.md5==hyrule.remoteMD5) {
        this.readyState = "running";
        log("Moblin."+this.pid+" is current & running.");
        return;
      }

      break;
   default:
     console.log(m);
  }
}

function areMoblinsAlive() {
  oldMoblins = new Array();
  deadMoblins = new Array();
  liveMoblins = new Array();
  for (moblinPID in hyrule.moblins) {
    var moblinC = hyrule.moblins[moblinPID];
    if (moblinC.exitCode!=null) {
      deadMoblins.push(moblinPID);
    }
    if (moblinC.md5!=hyrule.remoteMD5) {
      oldMoblins.push(moblinPID);
    }
    if (hyrule.fairy.timeoutDownload||hyrule.fairy.timeoutStartup) {
      log("DOWNLOAD IN PROGRESS.");
      return;
    }
    liveMoblins.push(moblinPID);
  }
  if (liveMoblins.length<parallelMoblins) {
    launchWhichMoblin();
  }
}

function fairyStats() {
  if (!hyrule.fairies.length) {
    return;
  }
  var output1 = '';
  var output2 = '';
  for (fairy in hyrule.fairies) {
    mC = hyrule.fairies[fairy];
    output1 += ' '+pad(mC.pid+'',9);
    output2 += ' '+pad(mC.earlyCount+'',4)+' '+pad(Math.round(hyrule.fairy.statsDelay/mC.lateCount)+'',4);
    mC.earlyCount=0;
    mC.lateCount=1;
  }
  log(output1);
  log(output2);
}

function pad(str,howmany) {
  while(str.length < howmany) {
    str = ' '+str;
  }
  return str;
}

function failedMoblinStartup() {
  /*
  console.log("New moblin failed to start up.");
  if (hyrule.moblins[hyrule.moblins.length-1].stdin && !hyrule.moblins[hyrule.moblins.length-1].stdin.destroyed) {
    hyrule.moblins[hyrule.moblins.length-1].send({fairy: "Goodbye."});
  } else {
    hyrule.moblins[hyrule.moblins.length-1].kill();
    //delete hyrule.moblins[hyrule.moblins.length-1];
  }
  if (hyrule.moblins[0].stdin && !hyrule.moblins[0].stdin.destroyed) {
    hyrule.moblins[0].send({fairy: "OK, keep going."});
  }
  fairy.versionCheckInterval = setInterval(moblinVersionCheck, fairy.versionCheckRate);
  */
}

function handleSocketError(socketException) {
  switch(socketException.code) {
    case "ECONNRESET":
      if (hyrule.fairy.umbilicalCord||hyrule.fairy.umbilicalCord===undefined) {
        log("I saw Zelda die.");
        hyrule.fairy.umbilicalCord = false;
      }
      break;
    case "ECONNREFUSED":
      if (hyrule.fairy.umbilicalCord||hyrule.fairy.umbilicalCord===undefined) {
        log("I can not find Zelda.");
        hyrule.fairy.umbilicalCord = false;
      }
      break;
    case "Unknown system errno 10060":
      if (hyrule.fairy.umbilicalCord||hyrule.fairy.umbilicalCord===undefined) {
        log("I can not find Zelda.");
        hyrule.fairy.umbilicalCord = false;
      }
      break;
    default:
      log(socketException);
  }
}
