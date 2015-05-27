#!/usr/bin/env node

var AWS = require('aws-sdk');
var moment = require('moment');
var q = require('q');
var fs = require('fs');
var _ = require('lodash');
var sshExec = require('ssh-exec');
var awsHelpers = require('./aws-helpers.js');

var argv = require('yargs')
  .usage('Usage: $0 --server-ip <SERVER_IP_ADDRESS>')
  .demand('s')
  .nargs('s', 1)
  .alias('s', 'server-ip')
  .describe('s', 'Specify the EC2 HPMS server IP address')
  .argv;

var AWS_IMAGE_NAME = 'amzn-ami-hvm-2015.03.0.x86_64-gp2';
var EC2_INSTANCE_TYPE = 't2.micro';

var ec2;

var KEY_NAME = 'hpms-stress-test';
var KEY_FILENAME = KEY_NAME + '.pem';
var SECURITY_GROUP_NAME = 'Stress test client security group';

var SECURITY_GROUP_ID;
var AWS_EC2_IMAGE_ID;
var AWS_EC2_INSTANCE_ID;
var AWS_EC2_INSTANCE_PUBLIC_IP;


function getEc2AllIpsInForPort(portNumber) {
  return {
    FromPort: portNumber,
    IpProtocol: 'tcp',
    IpRanges: [{
      CidrIp: '0.0.0.0/0'
    }],
    ToPort: portNumber
  };
}

function addSecurityRules() {
  var deferred = q.defer();

  var params = {
    GroupId: SECURITY_GROUP_ID,
    IpPermissions: [getEc2AllIpsInForPort(22)]
  };

  ec2.authorizeSecurityGroupIngress(params, function(err, data) {
    if (err) {
      console.log('Could not add Security Rules to Security Group');
      console.log(err, err.stack);
      deferred.reject();
    } else {
      console.log('Security Rules added!');
      deferred.resolve();
    }
  });

  return deferred.promise;
}

function retrieveInstancePublicIP() {
  return awsHelpers.retrieveInstancePublicIP({
    AWS_EC2_INSTANCE_ID: AWS_EC2_INSTANCE_ID
  }).
  then(function(publicIp) {
    console.log('Instance is running!');
    console.log('Public IP: ' + publicIp);
    AWS_EC2_INSTANCE_PUBLIC_IP = publicIp;
  });
}

function waitBeforeSSHing() {
  var counter = 0;
  var intervalTimer;
  var deferred = q.defer();

  process.stdout.write('Waiting before running setup script');
  intervalTimer = setInterval(function() {
    if (++counter === 120) {
      process.stdout.write('\n');
      clearInterval(intervalTimer);
      deferred.resolve();
    } else {
      process.stdout.write('.');
    }
  }, 1000);

  return deferred.promise;
}

function runSetupScript() {
  console.log('Customizing EC2 instance.');
  try {
    require('child_process').execSync('ssh -t -t -i ' + KEY_FILENAME + ' -o StrictHostKeyChecking=no ec2-user@' + AWS_EC2_INSTANCE_PUBLIC_IP + ' "sudo yum -y provides /usr/bin/ab; sudo yum -y install httpd-tools; echo \'ab -n 150000 -c 100  http://' + argv.s + ':4321/%7B%22type%22:%20%22myEventType%22,%20%22val1%22:%203,%20%22val2%22:%20%22abcd%22%20%7D\' > start_stress_test.sh; chmod +755 start_stress_test.sh; exit;"');
  } catch (e) {}
  console.log('\nSetup completed.');
}

function displaySuccessMessage() {
  console.log('\nInstance launched, set up and running!!!');
  console.log('Public IP: ' + AWS_EC2_INSTANCE_PUBLIC_IP);
}

function checkKeyPair() {
  var deferred = q.defer();

  if (fs.existsSync(KEY_FILENAME)) {
    console.log('key pair found on disk');
    deferred.resolve();
  } else {
    console.log('key pair not found on disk, creating a new one');
    awsHelpers.createKeyPair({
      key_name: KEY_NAME,
      key_filename: KEY_FILENAME
    }).
    then(function() {
      console.log('Key Pair created!');
      console.log(KEY_FILENAME);
      deferred.resolve();
    });
  }

  return deferred.promise;
}

function checkSecurityGroup() {
  var deferred = q.defer();

  ec2.describeSecurityGroups({
    Filters: [{
      Name: 'group-name',
      Values: [SECURITY_GROUP_NAME]
    }]
  }, function(err, data) {
    if (err) {
      console.log('Error retrieving security groups');
      deferred.reject();
    } else {
      if (data.SecurityGroups.length === 0) {
        console.log('Security group not found... creating a new one');
        createSecurityGroup({
          security_group_name: SECURITY_GROUP_NAME,
          security_group_description: 'hpms stress test security group'
        }).
        then(function(securityGroupId) {
          console.log('Security Group created!');
          console.log(securityGroupId);
          SECURITY_GROUP_ID = securityGroupId;
          return SECURITY_GROUP_ID;
        })
        then(addSecurityRules).
        then(deferred.resolve);
      } else {
        console.log('Security group found');
        SECURITY_GROUP_ID = data.SecurityGroups[0].GroupId;
        console.log(SECURITY_GROUP_ID);
        deferred.resolve();
      }
    }
  });

  return deferred.promise;
}

function retrieveImageId() {
  return awsHelpers.retrieveImageId({
    image_name: AWS_IMAGE_NAME
  }).
  then(function(imageId) {
    console.log('Image id found!');
    console.log(imageId);
    AWS_EC2_IMAGE_ID = imageId;
    return imageId;
  });
}

function createAndLaunchInstance() {
  return awsHelpers.createAndLaunchInstance({
    image_id: AWS_EC2_IMAGE_ID,
    instance_type: EC2_INSTANCE_TYPE,
    key_name: KEY_NAME,
    security_group_ids: [SECURITY_GROUP_ID]
  }).
  then(function(instanceId) {
    console.log('Instance created and launched');
    console.log(instanceId);
    AWS_EC2_INSTANCE_ID = instanceId;
  });
}

function init() {
  awsHelpers.configure(fs.readFileSync('aws_config.json'));
  ec2 = new AWS.EC2({
    apiVersion: '2015-04-15'
  });
}

function run() {
  checkKeyPair().
  then(checkSecurityGroup).
  then(retrieveImageId).
  then(createAndLaunchInstance).
  then(retrieveInstancePublicIP).
  then(waitBeforeSSHing).
  then(runSetupScript).
  then(displaySuccessMessage).
  fail(function(err) {
    err = err || {};
    console.log('error launching hpms client!\n' + err + '\n' + err.stack);
  });
}


init();
run();