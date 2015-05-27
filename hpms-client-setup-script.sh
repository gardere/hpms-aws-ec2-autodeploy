#!/bin/bash
yum -y provides /usr/bin/ab 
yum -y install httpd-tools
export SERVER_IP=REPLACE_THIS
echo 'ab -n 150000 -c 100  http://${SERVER_IP}:4321/%7B%22type%22:%20%22myEventType%22,%20%22val1%22:%203,%20%22val2%22:%20%22abcd%22%20%7D' > /home/ec2-user/start_stress_test.sh
chmod +755 /home/ec2-user/start_stress_test.sh
