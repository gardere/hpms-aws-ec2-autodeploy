var awsHelpers = require('./aws-helpers.js');
var fs = require('fs');
var _ = require('lodash');
var q = require('q');
var http = require('http');

function init() {
  awsHelpers.configure(JSON.parse(fs.readFileSync('aws_config.json')));
}

function retrieveStressClientsIps(options) {
  return awsHelpers.retrievePublicIpsMatchingTags({
    tags: [{
      type: 'stress-test-client'
    }]
  }).
  then(function(ips) {
    return _.extend(options || {}, {
      clientsIps: ips
    });
  });
}

function retrieveServerIp(options) {
  return awsHelpers.retrievePublicIpsMatchingTags({
    tags: [{
      type: 'hpms-server'
    }]
  }).
  then(function(ips) {
    return _.extend(options || {}, {
      serverIp: ips[0] || void 0
    });
  });
}

function startTests(options) {
	if (typeof options.serverIp === 'undefined') {
		throw 'Server IP address was not found';
	}
	if (options.clientsIps.length === 0) {
		throw 'No test clients available';
	}

	console.log('Server targeted: ' + options.serverIp);
	console.log('Starting stress test from ' + options.clientsIps.length + ' client(s):\n* ' + options.clientsIps.join('\n* '));

	for (var i=0; i < options.clientsIps.length; i+= 1) {
		startStressTestFromHost(options.clientsIps[i], 'http://' + options.serverIp + ':4321/%7B%22type%22:%20%22myEventType%22,%20%22val1%22:%203,%20%22val2%22:%20%22abcd%22%20%7D');
	}
}

function startStressTestFromHost(source, target) {
	var deferred = q.defer();


	var startTestUrl = 'http://' + source + ':7117/st/300/150000/' + encodeURIComponent(target);

	http.get(startTestUrl, function(response) {
        // Continuously update stream with data
        var body = '';
        response.on('data', function(d) {
            body += d;
        });
        response.on('end', function() {
        	deferred.resolve(body);
        	console.log('started test from ' + source);
        });
    });

    return deferred.promise;
}

init();

retrieveServerIp().
then(retrieveStressClientsIps).
then(startTests).
fail(function (error) {
	console.log(error);
});	