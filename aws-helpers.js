var AWS = require('aws-sdk');
var q = require('q');
var _ = require('lodash');
var ec2;

function getEc2() {
  if (!ec2) {
    throw 'Call \'configure(options)\' first';
  }
  return ec2;
}

function createKeyPair(options) {
  var deferred = q.defer();

  var params = {
    KeyName: options.key_name
  };
  getEc2().createKeyPair(params, function(err, data) {
    if (err) {
      console.log('Could not create key pair');
      console.log(err, err.stack);
      deferred.reject();
    } else {
      var keyData = data.KeyMaterial;
      fs.writeFileSync(options.key_filename, keyData, 'utf-8');
      fs.chmodSync(options.key_filename, '400');
      deferred.resolve(data);
    };
  });

  return deferred.promise;
}

function createSecurityGroup(options) {
  var deferred = q.defer();

  var params = {
    Description: options.security_group_description,
    GroupName: options.security_group_name
  };
  getEc2().createSecurityGroup(params, function(err, data) {
    if (err) {
      console.log('Could not create Security Group');
      console.log(err, err.stack);
      deferred.reject();
    } else {
      var securityGroupId = data.GroupId;
      deferred.resolve(securityGroupId);
    }
  });

  return deferred.promise;
}

function retrieveImageId(options) {
  var deferred = q.defer();

  getEc2().describeImages({
    Filters: [{
      Name: 'name',
      Values: [options.image_name]
    }]
  }, function(err, data) {
    if (err) {
      console.log('Could not find image id!');
      deferred.reject(err);
    } else {
      var imageId;

      if (data.Images && data.Images.length === 1) {
        var imageId = data.Images[0].ImageId;
        deferred.resolve(imageId);
      } else {
        console.log('Could not find image id!');
        deferred.reject();
      }
    }
  });

  return deferred.promise;
}

function createAndLaunchInstance(options) {
  var deferred = q.defer();

  var userData;

  if (options.additional_setup_data) {
    userData = new Buffer(options.additional_setup_data).toString('base64');
  }

  var params = {
    ImageId: options.image_id,
    MaxCount: options.number_of_instances || 1,
    MinCount: options.number_of_instances || 1,
    InstanceType: options.instance_type,
    KeyName: options.key_name,
    SecurityGroupIds: options.security_group_ids,
    UserData: userData
  };

  getEc2().runInstances(params, function(err, data) {
    if (err) {
      console.log('Could not launch instance!');
      console.log(err, err.stack);
      deferred.reject();
    } else {
      var instanceId = data.Instances[0].InstanceId;
      deferred.resolve(instanceId);
    }
  });

  return deferred.promise;
}

function retrieveInstancePublicIP(options) {
  var deferred = q.defer();

  getEc2().waitFor('instanceRunning', {
      InstanceIds: [options.instanceId]
    },
    function(err, data) {
      if (err) {
        console.log('Instance is not running!');
        console.log(err, err.stack);
        deferred.reject();
      } else {
        var publicIp = (data.Reservations[0].Instances[0].NetworkInterfaces[0].Association || {}).PublicIp;
        deferred.resolve(publicIp);
      }
    });

  return deferred.promise;
}

function addSecurityIngress(options) {
  var deferred = q.defer();

  var params = {
    GroupId: options.securityGroupId,
    IpPermissions: []
  };

  for (var i = 0; i < options.portList.length; i += 1) {
    params.IpPermissions.push(getEc2AllIpsInForPort(options.portList[i]));
  }

  getEc2().authorizeSecurityGroupIngress(params, function(err, data) {
    if (err) {
      console.log('Could not add Security Rules to Security Group');
      console.log(err, err.stack);
      deferred.reject();
    } else {
      deferred.resolve();
    }
  });

  return deferred.promise;
}

function addTags(options) {
  var deferred = q.defer();

  var tagsKeys = _.keys(options.tags);

  params = {
    Resources: [options.instanceId],
    Tags: []
  };

  for (var i = 0; i < tagsKeys.length; i += 1) {
    params.Tags.push({
      Key: tagsKeys[i],
      Value: options.tags[tagsKeys[i]]
    });
  }

  getEc2().createTags(params, function(err) {
    if (err) {
      deferred.reject(err);
    } else {
      deferred.resolve();
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

function configure(options) {
  AWS.config = new AWS.Config({
    accessKeyId: options.access_key_id,
    secretAccessKey: options.secret_access_key,
    region: options.region
  });
  ec2 = new AWS.EC2({
    apiVersion: '2015-04-15'
  });
}


module.exports.configure = configure;
module.exports.createKeyPair = createKeyPair;
module.exports.createSecurityGroup = createSecurityGroup;
module.exports.retrieveImageId = retrieveImageId;
module.exports.createAndLaunchInstance = createAndLaunchInstance;
module.exports.retrieveInstancePublicIP = retrieveInstancePublicIP;
module.exports.addSecurityIngress = addSecurityIngress;
module.exports.addTags = addTags;
