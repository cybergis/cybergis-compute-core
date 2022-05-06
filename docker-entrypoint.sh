#!/bin/bash

source /opt/conda/bin/activate
conda activate jobsupdev_v1

pip uninstall -y cybergis
cd /job_supervisor/Jupyter-xsede
python setup.py develop

cd /job_supervisor
npm install

# compile TypeScript
npm run build

# set SSH config
cat >> /etc/ssh_config <<EOT
Host *
    StrictHostKeyChecking no
EOT

tsc
# run server
LOGLEVEL=DEBUG DEBUG_LEVEL=DEBUG node ./server.js
