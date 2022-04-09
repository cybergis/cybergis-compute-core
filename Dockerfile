#cybergisx/job_supervisor_v1:34f97bfeadad
FROM continuumio/miniconda3:4.10.3p1

RUN conda install -y -c conda-forge mamba
COPY ./environment_dev_all.yml /tmp/environment_dev_all.yml
RUN mamba env create -f /tmp/environment_dev_all.yml
RUN /bin/bash -c "source /opt/conda/bin/activate && \
    conda activate jobsupdev_v1 && \
    npm install -g typescript"

EXPOSE 3000
RUN mkdir -p /job_supervisor
WORKDIR /job_supervisor
