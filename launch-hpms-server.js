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
  setup_data: '#!/bin/bash\ncurl -s https://gist.githubusercontent.com/gardere/631bce85dfbd438cfa1a/raw/6eccd503636964b362c0ee40ec65fac3983c7dc9/aws-hpms-setup.sh | bash',
  instance_type: argv.i,
  tags: {
    type: 'hpms-server',
    version: '1.0'
  }
};

require('./launch-hpms-instance.js').launchHpmsInstance(options).
then(displaySuccessMessage);


function displaySuccessMessage(result) {
  console.log('\nInstance launched, set up and running!!!');
  console.log('Public IP: ' + result.instance_public_ip);
  console.log('\nRabbit MQ Web UI available at: http://' + result.instance_public_ip + ':15672/');
  console.log('Username: hpms_admin');
  console.log('Password: myP455w0Rd');
  console.log('\nHPMS endpoint: http://' + result.instance_public_ip + ':4321');
}
