#!/usr/bin/env node

var argv = require('yargs')
  .usage('Usage: $0 --server-ip <SERVER_IP_ADDRESS>')
  .demand('s')
  .nargs('s', 1)
  .alias('s', 'server-ip')
  .describe('s', 'Specify the EC2 HPMS server IP address')
  .argv;

var fs = require('fs');
var setupData = fs.readFileSync('hpms-client-setup-script.sh').toString();
setupData = setupData.replace('REPLACE_THIS', argv.s);

var options = {
  portList: [22],
  securityGroupName: 'Stress test client security group',
  setupData: setupData
};

require('./launch-hpms-instance.js').launchHpmsInstance(options).
then(displaySuccessMessage);

function displaySuccessMessage(result) {
  console.log('\nInstance launched, set up and running!!!');
  console.log('Public IP: ' + result.instancePublicIp);
}
