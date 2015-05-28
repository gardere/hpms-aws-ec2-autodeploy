#!/bin/bash
yum -y provides /usr/bin/ab 
yum -y install httpd-tools

yum install -y nodejs npm --enablerepo=epel
npm install -g pm2

cd /home/ec2-user
runuser -l  ec2-user -c 'wget https://gist.githubusercontent.com/gardere/ca9735292c86fce97e22/raw/decb41ae186659529da94bc17f1272a2139a64e6/node-ab-commander.js'
runuser -l  ec2-user -c 'npm install express'
runuser -l  ec2-user -c 'pm2 start node-ab-commander.js'
