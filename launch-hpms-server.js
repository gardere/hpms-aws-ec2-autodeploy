#!/usr/bin/env node

var options = {
  portList: [4321, 3001, 15672, 22],
  securityGroupName: 'HPMS server security group',
  setupData: 'curl -s https://gist.githubusercontent.com/gardere/631bce85dfbd438cfa1a/raw/264d59527d2848153075fa5923847ebae17ef5c5/aws-hpms-setup.sh | bash',
};

require('./launch-hpms-instance.js').launchHpmsInstance(options).
then(displaySuccessMessage);


function displaySuccessMessage(result) {
  console.log('\nInstance launched, set up and running!!!');
  console.log('Public IP: ' + result.instancePublicIp);
  console.log('\nRabbit MQ Web UI available at: http://' + result.instancePublicIp + ':15672/');
  console.log('Username: hpms_admin');
  console.log('Password: myP455w0Rd');
  console.log('\nHPMS endpoint: http://' + result.instancePublicIp + ':4321');
}
