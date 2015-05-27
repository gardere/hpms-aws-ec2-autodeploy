#!/usr/bin/env node

var argv = require('yargs')
  .usage('Usage: $0 --server-ip <SERVER_IP_ADDRESS> --instances-count --instance-type <INSTANCE_TYPE>')
  .demand('s')
  .nargs('s', 1)
  .alias('s', 'server-ip')
  .describe('s', 'Specify the EC2 HPMS server IP address')
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
  port_list: [22],
  security_group_name: 'Stress test client security group',
  setup_data: setupData,
  instances_count: argv.c
};

require('./launch-hpms-instance.js').launchHpmsInstance(options).
then(displaySuccessMessage);

function displaySuccessMessage(result) {
  console.log('\nInstance launched, set up and running!!!');
  console.log('Public IP: ' + result.instance_public_ip);
}
