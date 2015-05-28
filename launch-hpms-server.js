#!/usr/bin/env node

var argv = require('yargs')
  .usage('Usage: $0 --instance-type <INSTANCE_TYPE>')
  .nargs('i', 1)
  .alias('i', 'instance-type')
  .describe('i', 'AWS instance type')
  .default('i', 't2.micro')
  .help('h')
  .alias('h', 'help')
  .argv;

var options = {
  port_list: [4321, 3001, 15672, 22],
  security_group_name: 'HPMS server security group',
  setup_data: '#!/bin/bash\ncurl -s https://gist.githubusercontent.com/gardere/631bce85dfbd438cfa1a/raw/0a1067ba20f40b87dbe41d890667fb9dfa03b179/aws-hpms-setup.sh | bash',
  instance_type: argv.i,
  tags: {
    type: 'hpms-server',
    version: '1.0'
  }
};

require('./launch-hpms-instance.js').launchHpmsInstance(options).
then(displaySuccessMessage).
fail(function (err) {
  console.log('error launching hpms server: ' + err);
});



function displaySuccessMessage(result) {
  console.log('\nInstance launched, set up and running!!!');
  console.log('Public IP: ' + result.instance_public_ips[0]);
  console.log('\nRabbit MQ Web UI available at: http://' + result.instance_public_ips[0] + ':15672/');
  console.log('Username: hpms_admin');
  console.log('Password: myP455w0Rd');
  console.log('\nHPMS endpoint: http://' + result.instance_public_ips[0] + ':4321');
}
