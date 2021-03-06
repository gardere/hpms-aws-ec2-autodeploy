#!/usr/bin/env node

var argv = require('yargs')
  .usage('Usage: $0 --instances-count --instance-type <INSTANCE_TYPE>')
  .nargs('c', 1)
  .alias('c', 'instances-count')
  .default('c', 1)
  .describe('c', 'Specify the number of AWS EC2 to be started')
  .nargs('i', 1)
  .alias('i', 'instance-type')
  .describe('i', 'AWS instance type')
  .default('i', 't2.micro')
  .help('h')
  .alias('h', 'help')
  .argv;

var fs = require('fs');
var setupData = fs.readFileSync('hpms-client-setup-script.sh').toString();
setupData = setupData.replace('REPLACE_THIS', argv.s);

var options = {
  port_list: [22, 7117],
  security_group_name: 'Stress test client security group',
  setup_data: setupData,
  instances_count: argv.c,
  instance_type: argv.i,
  tags: {
    type: 'stress-test-client',
    version: '1.0'
  }
};

require('./launch-hpms-instance.js').launchHpmsInstance(options).
then(displaySuccessMessage).
fail(function (err) {
  console.log('error launching client(s): ' + err);
});

function displaySuccessMessage(result) {
  console.log('\nInstance launched, set up and running!!!');
  console.log('Public IPs: ' + result.instance_public_ips);
}
