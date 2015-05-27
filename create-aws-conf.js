var fs = require('fs');
var _ = require('lodash');
var q = require('q');
var prompt = require('prompt');

var AWS_ACCESS_KEY_ID;
var AWS_SECRET_ACCESS_KEY;

prompt.message = ""
prompt.delimiter = " - ";

prompt.start();

prompt.get({
  properties: {
    hasAccount: {
      description: "Do you have a valid AWS account (y/n)? ".white
    }
  }
}, function(err, result) {
  if ((result.hasAccount === 'y') || (result.hasAccount === 'Y')) {
    requestAWSAccountDetails();
  } else if ((result.hasAccount === 'n') || (result.hasAccount === 'N')) {
    showInstructions();
  }
});


function requestAWSAccountDetails() {
  console.log('\n\nPlease enter your details'.white);

  prompt.get({
    properties: {
      awsAccessKeyId: {
        description: "AWS Access Key Id".white
      },
      awsSecretAccessKey: {
        description: "AWS Secret Access Key".white
      },
    }
  }, function(err, result) {
    fs.writeFileSync('aws_config.json', JSON.stringify({
      access_key_id: result.awsAccessKeyId,
      secret_access_key: result.awsSecretAccessKey,
      region: 'us-west-2'
    }));
    console.log('\n\nYour configuration file (aws_config.json) is now created.\nYou can edit it anytime you want to use different AWS credentials.'.white);
  });
}

function showInstructions() {
  console.log('\nPlease sign up for a AWS account.'.red);
  console.log('Then run `'.red + 'node create-aws-conf.js'.yellow + '`'.red);
}
