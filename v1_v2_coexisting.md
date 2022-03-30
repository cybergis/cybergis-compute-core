# CyberGIS-Compute-Core Deploy Notes

The goal is to have compute-v1 (non-dockerized) and compute-v2 coexist on the same VM

A nginx container takes care of HTTPS and proxying

/v2/ ---> compute-2 container (port 3030)

/ ---> compute-1 instance on host (port 3000)

Tested Environment

```
Ubuntu 18.04.5 LTS
Docker 20.10.7
Docker-Compose 1.29.2 
```

1. Create a docker network

```
# For docker >= 20.10, Port XXXX on the host can be accessed from within container at host.docker.internal if using a user-defined bridge network
# nginx compose file should have
extra_hosts:
      - "host.docker.internal:host-gateway"
# see: https://stackoverflow.com/questions/48546124/what-is-linux-equivalent-of-host-docker-internal/67158212#67158212

docker network create -d bridge  my-cybergis-compute-network
```

```
# For docker < 20.10: Port XXXX on the host can be accessed from within container at 172.99.99.1:XXXX as the selected ip below
# the selected ip range is to avoid conflict with existing networks.
# see: https://stackoverflow.com/questions/31324981/how-to-access-host-port-from-docker-container/31328031#31328031

docker network create -d bridge --subnet=172.30.0.0/16 my-cybergis-compute-network
```

2. Configure firewall on host to allow connections from container to specific port on host

```
# see https://www.cloudaccess.net/cloud-control-panel-ccp/157-dns-management/322-subnet-masks-reference-table.html
ufw allow from 172.0.0.0/8 to any port 3000
```
