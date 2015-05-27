var AWS = require('aws-sdk');
var moment = require('moment');
var q = require('q');
var fs = require('fs');
var _ = require('lodash');
var awsHelpers = require('./aws-helpers.js');

var AWS_IMAGE_NAME = 'amzn-ami-hvm-2015.03.0.x86_64-gp2';
var EC2_INSTANCE_TYPE = 't2.micro';

var ec2;

var KEY_NAME = 'hpms-stress-test';
var KEY_FILENAME = KEY_NAME + '.pem';
var SECURITY_GROUP_NAME;

var SECURITY_GROUP_ID;
var AWS_EC2_IMAGE_ID;
var AWS_EC2_INSTANCE_ID;
var AWS_EC2_INSTANCE_PUBLIC_IP;
var NUMBER_OF_INSTANCES;

var PORT_LIST;


function addSecurityRules() {
  return awsHelpers.addSecurityIngress({
    securityGroupId: SECURITY_GROUP_ID,
    portList: PORT_LIST
  }).
  then(function() {
    console.log('Security Rules added!');
  });
}

function retrieveInstancePublicIP() {
  return awsHelpers.retrieveInstancePublicIP({
    instanceId: AWS_EC2_INSTANCE_ID
  }).
  then(function(publicIp) {
    console.log('Instance is running!');
    console.log('Public IP: ' + publicIp);
    AWS_EC2_INSTANCE_PUBLIC_IP = publicIp;
    return publicIp;
  });
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
        awsHelpers.createSecurityGroup({
          security_group_name: SECURITY_GROUP_NAME,
          security_group_description: 'hpms stress test security group'
        }).
        then(function(securityGroupId) {
          console.log('Security Group created!');
          console.log(securityGroupId);
          SECURITY_GROUP_ID = securityGroupId;
          return SECURITY_GROUP_ID;
        }).
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
    security_group_ids: [SECURITY_GROUP_ID],
    number_of_instances: NUMBER_OF_INSTANCES,
    additional_setup_data: SETUP_DATA
  }).
  then(function(instanceId) {
    console.log('Instance created and launched');
    console.log(instanceId);
    AWS_EC2_INSTANCE_ID = instanceId;
  });
}

function addTags() {
  if (AWS_EC2_INSTANCE_TAGS) {
    awsHelpers.addTags({
      instanceId: AWS_EC2_INSTANCE_ID,
      tags: AWS_EC2_INSTANCE_TAGS
    });
  }
}

function init() {
  awsHelpers.configure(JSON.parse(fs.readFileSync('aws_config.json')));
  ec2 = new AWS.EC2({
    apiVersion: '2015-04-15'
  });
}

function run() {
  return checkKeyPair().
  then(checkSecurityGroup).
  then(retrieveImageId).
  then(createAndLaunchInstance).
  then(addTags).
  then(retrieveInstancePublicIP).
  then(function () {
    return {
      instance_public_ip: AWS_EC2_INSTANCE_PUBLIC_IP
    };
  })
  fail(function(err) {
    err = err || {};
    console.log('error launching hpms instance!\n' + err + '\n' + err.stack);
  });
}

function launchHpmsInstance(options) {
  PORT_LIST = options.port_list;
  SECURITY_GROUP_NAME = options.security_group_name;
  SETUP_DATA = options.setup_data;
  EC2_INSTANCE_TYPE = options.instance_type || EC2_INSTANCE_TYPE;
  NUMBER_OF_INSTANCES = options.instances_count || NUMBER_OF_INSTANCES;
  AWS_EC2_INSTANCE_TAGS = options.tags;
  init();
  return run();
}


module.exports.launchHpmsInstance = launchHpmsInstance;
