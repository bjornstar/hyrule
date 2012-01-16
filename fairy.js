var crypto = require('crypto');
var fs     = require('fs');
var http   = require('http');
var fork   = require('child_process').fork;
var util   = require('util');

var appName = 'fairy';
var appStart = new Date();

var hyrule = new Object();
hyrule.moblins = new Array();

hyrule.fairy = new Object();
var fairy = hyrule.fairy;

fs.readFile('fairy.js', 'utf8', function(err, data) {
  if (err) throw err;
  fairy.md5 = crypto.createHash('md5').update(data).digest('hex');
  console.log('['+new Date().toISOString()+'] Fairy MD5:  '+fairy.md5);
});

function launchMoblin() {
  fs.readFile('moblin.js', 'utf8', function(err, data) {
    if (err) {
      console.log('['+new Date().toISOString()+'] Cannot find moblin.js, will download from Zelda.');
      hyrule.moblins.push({md5:''});
      return;
    }
    var moblinMD5 = crypto.createHash('md5').update(data).digest('hex');
    console.log('['+new Date().toISOString()+'] Moblin MD5: '+moblinMD5);

    hyrule.moblins.push(fork('moblin.js')); // This doesn't launch moblin until the file is read and MD5 is performed.

    process.on('exit', function () {
     hyrule.moblins[0].send({fairy:'Goodbye.'});
    });

    hyrule.moblins[0].md5 = moblinMD5;
    hyrule.moblins[0].on('message', function moblinMessage(m) {
      handleMoblinMessage(m);
    });
  });
}

hyrule.zeldaHost = 'localhost';

hyrule.zeldaDownload = {
  host: hyrule.zeldaHost,
  method: 'GET',
  path: '/moblin.js',
  port: 3000
};

hyrule.zeldaVersion = {
  host: hyrule.zeldaHost,
  method: 'GET',
  path: '/version',
  port: 3000
};

fairy.checkCount = 0;
fairy.prevCheckCount = 0;
fairy.dlCount = 0;
fairy.prevDlCount = 0;
fairy.versionCheckRate = 5000;
fairy.versionCheckInterval = setInterval(moblinVersionCheck, fairy.versionCheckRate);

function moblinVersionCheck () {
  fairy.checkCount++;

  var versionData='';

  var versionRequest = http.request(hyrule.zeldaVersion, function(res) {
    versionRequest.once('error', handleSocketError);
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

  versionRequest.once('error', handleSocketError);
  versionRequest.end();
}

function handleVersionCheck(data) {
  if (!fairy.umbilicalCord) {
    console.log('['+new Date().toISOString()+'] Fairy found Zelda.');
    fairy.umbilicalCord = true;
  }

  var remoteHyrule = JSON.parse(data);

  fairy.prevCheckCount = fairy.checkCount;

  hyrule.remoteMD5 = remoteHyrule.moblin.md5;

  for (moblinNumber in hyrule.moblins) {
    var moblin = hyrule.moblins[moblinNumber];

    if (remoteHyrule.moblin.md5==moblin.md5) {
      return;
    }

    console.log('['+new Date().toISOString()+'] Zelda says she is in Hyrule v'+remoteHyrule.version);
    console.log('['+new Date().toISOString()+'] Zelda\'s MD5: '+remoteHyrule.moblin.md5);
    console.log('['+new Date().toISOString()+'] Your MD5:    '+moblin.md5);
    console.log('['+new Date().toISOString()+'] Downloading new moblin.js');

    if (!fairy.timeoutDownload) {
      fairy.timeoutDownload = setTimeout(moblinDownload, 50);
    }
  }
}

function moblinDownload() {
  fairy.dlCount++;

  if (fairy.dlCount >=50) {
    clearTimeout(fairy.timeoutDownload);
    fairy.dlCount = 0;
  }

  delete fairy.timeoutDownload;

  var downloadRequest = http.request(hyrule.zeldaDownload, function(res) {
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
    if (!fairy.timeoutDownload) {
      fairy.timeoutDownload = setTimeout(moblinDownload, 1000);
    }
  });

  downloadRequest.end();
}

function handleDownloadFinished(data) {
  if (!fairy.umbilicalCord) {
    console.log('['+new Date().toISOString()+'] Found Zelda.');
    fairy.umbilicalCord = true;
  }

  clearInterval(fairy.versionCheckInterval);
  delete fairy.versionCheckInterval;

  fs.readFile('newmoblin.js', 'utf8', function verifyNewMoblin(err, data) {
    if (err) {
      console.log('['+new Date().toISOString()+'] Problem reading newmoblin.js, trying again.');
      if (!fairy.timeoutDownload) {
        fairy.timeoutDownload = setTimeout(moblinDownload, 1000);
        return;
      }
    }
    var newMoblinMD5 = crypto.createHash('md5').update(data).digest('hex');
    if (newMoblinMD5 != hyrule.remoteMD5) {
      console.log('['+new Date().toISOString()+'] Problem with download, trying again.');
      if (!fairy.timeoutDownload) {
        fairy.timeoutDownload = setTimeout(moblinDownload, 1000);
        return;
      }
    }

    // Probably should do something to make sure we don't fork bomb.

    if (hyrule.moblins[0].stdin && !hyrule.moblins[0].stdin.destroyed) {
      hyrule.moblins[0].send({fairy: 'Hold on a sec.'});
    }

    hyrule.moblins.push(fork('newmoblin.js'));
    var newMoblin = hyrule.moblins[hyrule.moblins.length-1];
    newMoblin.md5 = newMoblinMD5;
    newMoblin.on('message', function newMoblinMessage(m) {
      handleMoblinMessage(m);
    });
    fairy.timeoutStartup = setTimeout(failedMoblinStartup, 1000); // This is probably bad too.
    delete fairy.timeoutDownload;
  });
}

function handleMoblinMessage(m) {
  switch (m.moblin) {
    case 'I handled my first task.':
      if (hyrule.moblins.length>1) {
        fs.rename('newmoblin.js', 'moblin.js', function renameNewMoblin(err) {
          var oldMoblin = hyrule.moblins.shift();
          if (oldMoblin.stdin && !oldMoblin.stdin.destroyed) {
            oldMoblin.send({fairy:'Goodbye.'});
          }
          moblin = hyrule.moblins[0];

          fairy.versionCheckInterval = setInterval(moblinVersionCheck, fairy.versionCheckRate);
          clearTimeout(fairy.timeoutStartup);
          delete fairy.timeoutStartup;
        });
      }
      break;
    default:
      console.log(m);
  }
}

function areMoblinsAlive() {
  for (intMoblin in hyrule.moblins) {
    var moblinC = hyrule.moblins[intMoblin];
    if (!moblinC.exitCode) {
      return;
    }
    if (fairy.timeoutDownload||fairy.timeoutStartup) {
      return;
    }
  }
  var deadMoblin = hyrule.moblins.shift();
  launchMoblin();
}

areMoblinsAlive();
hyrule.areMoblinsAliveInterval = setInterval(areMoblinsAlive,5000);

function failedMoblinStartup() {
  console.log('New Moblin failed to start up.');
  if (hyrule.moblins[0].stdin && !hyrule.moblins[0].stdin.destroyed) {
    hyrule.moblins[0].send({fairy: 'OK, keep going.'});
  }
  fairy.versionCheckInterval = setInterval(moblinVersionCheck, fairy.versionCheckRate);
}

function handleSocketError(socketException) {
  switch(socketException.code) {
    case 'ECONNRESET':
      if (fairy.umbilicalCord||fairy.umbilicalCord===undefined) {
        console.log('['+new Date().toISOString()+'] Fairy saw Zelda die.');
        fairy.umbilicalCord = false;
      }
      break;
    case 'ECONNREFUSED':
      if (fairy.umbilicalCord||fairy.umbilicalCord===undefined) {
        console.log('['+new Date().toISOString()+'] Fairy can\'t find Zelda.');
        fairy.umbilicalCord = false;
      }
      break;
    default:
      console.log(socketException);
  }
}

