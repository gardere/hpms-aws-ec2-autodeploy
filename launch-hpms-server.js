#!/usr/bin/env node 

var AWS = require('aws-sdk');
var moment = require('moment');
var q = require('q');
var fs = require('fs');
var _ = require('lodash');
var sshExec = require('ssh-exec');

var AWS_IMAGE_NAME = 'amzn-ami-hvm-2015.03.0.x86_64-gp2';
var EC2_INSTANCE_TYPE = 'c4.4xlarge';
//var EC2_INSTANCE_TYPE = 'c4.8xlarge';

var config = new AWS.Config({
  accessKeyId: 'XXXXXXXX',
  secretAccessKey: 'XXXXXXXX',
  region: 'us-west-2'
});

AWS.config = config;

var ec2 = new AWS.EC2({
  apiVersion: '2015-04-15'
});

var KEY_NAME = moment().format('YYYYMMDD-HHmmss');
var LAUNCH_DETAILS_FILE = 'instance-launch-details_' + KEY_NAME + '.json';
var KEY_FILENAME = KEY_NAME + '.pem';

var SECURITY_GROUP_ID;
var AWS_EC2_IMAGE_ID;
var AWS_EC2_INSTANCE_ID;
var AWS_EC2_INSTANCE_PUBLIC_IP;

function createKeyPair() {
  var deferred = q.defer();

  var params = {
    KeyName: KEY_NAME
  };
  ec2.createKeyPair(params, function(err, data) {
    if (err) {
      console.log('Could not create key pair');
      console.log(err, err.stack);
      deferred.reject();
    } else {
      KEY_DATA = data.KeyMaterial;
      fs.writeFileSync(KEY_FILENAME, KEY_DATA, 'utf-8');
      fs.chmodSync(KEY_FILENAME, '400');
      console.log('Key Pair created!');
      console.log(KEY_FILENAME);
      deferred.resolve(data);
    };
  });

  return deferred.promise;
}

function createSecurityGroup() {
  var deferred = q.defer();

  var params = {
    Description: KEY_NAME + ' security group',
    GroupName: KEY_NAME
  };
  ec2.createSecurityGroup(params, function(err, data) {
    if (err) {
      console.log('Could not create Security Group');
      console.log(err, err.stack);
      deferred.reject();
    } else {
      SECURITY_GROUP_ID = data.GroupId;
      console.log('Security Group created!');
      console.log(SECURITY_GROUP_ID);
      deferred.resolve(data.GroupId);
    }
  });

  return deferred.promise;
}

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
    IpPermissions: [getEc2AllIpsInForPort(4321), getEc2AllIpsInForPort(3001), getEc2AllIpsInForPort(15672), getEc2AllIpsInForPort(22)]
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

function retrieveImageId() {
  var deferred = q.defer();

  ec2.describeImages({
    Filters: [{
      Name: 'name',
      Values: [AWS_IMAGE_NAME]
    }]
  }, function(err, data) {
    if (err) {
      console.log('Could not find image id!');
      console.log(err, err.stack);
      deferred.reject(err);
    } else {
      var imageId;

      if (data.Images && data.Images.length === 1) {
        console.log('Image id found!');
        AWS_EC2_IMAGE_ID = data.Images[0].ImageId;
        console.log(AWS_EC2_IMAGE_ID);
        deferred.resolve(AWS_EC2_IMAGE_ID);
      } else {
        console.log('Could not find image id!');
        deferred.reject();
      }
    }
  });

  return deferred.promise;
}

function createAndLaunchInstance() {
  var deferred = q.defer();

  var params = {
    ImageId: AWS_EC2_IMAGE_ID,
    MaxCount: 1,
    MinCount: 1,
    InstanceType: EC2_INSTANCE_TYPE,
    KeyName: KEY_NAME,
    SecurityGroups: [KEY_NAME]
  };

  ec2.runInstances(params, function(err, data) {
    if (err) {
      console.log('Could not launch instance!');
      console.log(err, err.stack);
      deferred.reject();
    } else {
      AWS_EC2_INSTANCE_ID = data.Instances[0].InstanceId;
      console.log('Instance created and launched');
      console.log(data.Instances[0].InstanceId);
      deferred.resolve(data);
    }
  });

  return deferred.promise;
}

function retrieveInstancePublicIP() {
  var deferred = q.defer();

  ec2.waitFor('instanceRunning', {
      InstanceIds: [AWS_EC2_INSTANCE_ID]
    },
    function(err, data) {
      if (err) {
        console.log('Instance is not running!');
        console.log(err, err.stack);
        deferred.reject();
      } else {
        console.log('Instance is running!');
        AWS_EC2_INSTANCE_PUBLIC_IP = (data.Reservations[0].Instances[0].NetworkInterfaces[0].Association || {}).PublicIp;
        console.log('Public IP: ' + AWS_EC2_INSTANCE_PUBLIC_IP);
        deferred.resolve(data);
      }
    });

  return deferred.promise;
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
  console.log('Setting up packages on EC2 instance. Patience, it can take quite a while.');
  try {
	  require('child_process').execSync('ssh -t -t -i ' + KEY_FILENAME + ' -o StrictHostKeyChecking=no ec2-user@' + AWS_EC2_INSTANCE_PUBLIC_IP + ' "curl -s https://gist.githubusercontent.com/gardere/631bce85dfbd438cfa1a/raw/264d59527d2848153075fa5923847ebae17ef5c5/aws-hpms-setup.sh | bash"');
  } catch(e) {}
  console.log('\nSetup completed.');
}

function displaySuccessMessage() {
  console.log('\nInstance launched, set up and running!!!');
  console.log('Public IP: ' + AWS_EC2_INSTANCE_PUBLIC_IP);
  console.log('\nRabbit MQ Web UI available at: http://' + AWS_EC2_INSTANCE_PUBLIC_IP + ':15672/');
  console.log('Username: hpms_admin');
  console.log('Password: myP455w0Rd');
  console.log('\nHPMS endpoint: http://' + AWS_EC2_INSTANCE_PUBLIC_IP + ':4321');
}

createKeyPair().
then(createSecurityGroup).
then(addSecurityRules).
then(retrieveImageId).
then(createAndLaunchInstance).
then(retrieveInstancePublicIP).
then(waitBeforeSSHing).
then(runSetupScript).
then(displaySuccessMessage);

