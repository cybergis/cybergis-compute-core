#!/bin/bash
echo "installing node modules..."
npm install

echo "setup iptables..."
if command -v iptables &> /dev/null
then
    # delete
    iptables -D INPUT -i eth0 -p tcp -m tcp --dport 443 -j ACCEPT
    iptables -D INPUT -p tcp -m tcp --dport 443 -j ACCEPT
    iptables -D INPUT -i eth0 -p tcp -m tcp --dport 22 -j ACCEPT
    iptables -D INPUT -p tcp -m tcp --dport 22 -j ACCEPT
    iptables -D INPUT -i eth0 -p tcp -m tcp --dport 3000 -j ACCEPT
    iptables -D INPUT -p tcp -m tcp --dport 3000 -j ACCEPT

    # add
    iptables -A INPUT -i eth0 -p tcp -m tcp --dport 443 -j ACCEPT
    iptables -A INPUT -p tcp -m tcp --dport 443 -j ACCEPT
    iptables -A INPUT -i eth0 -p tcp -m tcp --dport 22 -j ACCEPT
    iptables -A INPUT -p tcp -m tcp --dport 22 -j ACCEPT
    iptables -A INPUT -i eth0 -p tcp -m tcp --dport 3000 -j ACCEPT
    iptables -A INPUT -p tcp -m tcp --dport 3000 -j ACCEPT
fi

echo "copying config files..."
cp -i ./config.example.json ./config.json
cp -i ./configs/hpc.example.json ./configs/hpc.json
cp -i ./configs/maintainer.example.json ./configs/maintainer.json
