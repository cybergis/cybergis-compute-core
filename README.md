# CyberGIS Compute Core
Scalable middleware framework for enabling high-performance and data-intensive geospatial research and education on CyberGISX. 

## Supported Git Projects
| Name                                  | URL                                                                              |
|---------------------------------------|----------------------------------------------------------------------------------|
| hello_world                           | https://github.com/cybergis/cybergis-compute-hello-world.git                     |
| summa3                                | https://github.com/cybergis/cybergis-compute-v2-summa.git                        |
| wrfhydro-5.x                          | https://github.com/cybergis/cybergis-compute-v2-wrfhydro.git                     |
| uncertainty_in_spatial_accessibility  | https://github.com/JinwooParkGeographer/Uncertainty-in-Spatial-Accessibility.git |
| mpi_hello_world                       | https://github.com/cybergis/cybergis-compute-mpi-helloworld.git                  |
| data_fusion                           | https://github.com/CarnivalBug/data_fusion.git                                   |
> If you'd like to add your Git project to our supported list, please contact xxx@illinois.edu

## Supported HPC & Computing Resources

| Name                      | Code              | Description                                                                                      |
|---------------------------|-------------------|--------------------------------------------------------------------------------------------------|
| Keeling Computing Cluster | keeling_community | University of Illinois HPC for enabling geospatial research and education at the CyberGIS Center |
| Bridges-2                 | bridges_community | Pittsburgh Supercomputing Center HPC                                                             |
| XSEDE Expanse             | expanse_community | San Diego Supercomputer Center                                                                   |

## Content
- [Server Setup](https://github.com/cybergis/cybergis-compute-core/tree/v2#server-setup)
- [Configurations](https://github.com/cybergis/cybergis-compute-core/tree/v2#configurations)
- [Development Guide](https://github.com/cybergis/cybergis-compute-core/tree/v2#development-terminologies)
- [Singularity Hello World Development](https://github.com/cybergis/cybergis-compute-core/tree/v2#singularity-hello-world-development)
  - [SlrumConnector](https://github.com/cybergis/cybergis-compute-core/tree/v2#slrumconnector)
  - [SingularityConnector](https://github.com/cybergis/cybergis-compute-core/tree/v2#singularityconnector)
  - [Write a hello world job!](https://github.com/cybergis/cybergis-compute-core/tree/v2#write-a-hello-world-job)

***

## Server Setup
1. Requirements
    - Docker & Docker Compose

2. Initialize
    ```bash
    git clone https://github.com/cybergis/cybergis-compute-core.git
    cd cybergis-compute-core
    # run init script
    ./script/init.sh
    ```

3. Configure the following options
   - config.json
     - `local_key`
       - `private_key_path`
       - `passphrase` (if required)
   - configs/hpc.json
     - `external_key`
       - `private_key_path`
       - `passphrase` (if required)

4. Run server
    ```bash
    # for development
    # - run in foreground with log output
    ./script/develop-start.sh
    # - run in background, add -b background failing
    ./script/develop-start.sh -b
    # - some HPC requires university network
    # - to connect to a University VPN, add the AnyConnect options
    ./script/develop-start.sh -l vpn.cites.illinois.edu -u NetID -p "password" -g 5_SplitTunnel_NoPrivate

    # for production server only
    ./script/production-start.sh
    ```

5. Stop all running containers
    ```bash
    ./script/stop.sh
    ```

***

## Configurations

1. HPC configurations are located at `configs/hpc.json`
    - community account example
    ```json
    {
        "keeling_community": {
            "ip": "keeling.earth.illinois.edu",
            "port": 22,
            "is_community_account": true,
            "community_login": {
                "user": "cigi-gisolve",
                "use_local_key": false,
                "external_key": {
                    "private_key_path": "cigi-gisolve.key",
                    "passphrase": null
                }
              },
              "root_path": "/data/keeling/a/cigi-gisolve/scratch/dev"
        }
    }
    ```

    - private account example
    ```json
    {
        "hadoop": {
            "ip": "hadoop01.cigi.illinois.edu",
            "port": 50022,
            "is_community_account": false,
            "connector": "SlurmConnector"
        }
    }
    ```

2. Maintainer configurations are located at `configs/maintainer.json`
    - example maintainer with user upload file
    ```json
    {
        "SUMMA": {
            "hpc": ["keeling_community"],
            "job_pool_capacity": 5,
            "executable_folder": {
                "from_user": true,
                "file_config": {
                    "ignore": [],
                    "must_have": [
                        "summa_options.json",
                        "installTestCases_local.sh",
                        "data",
                        "output",
                        "settings"
                    ],
                    "ignore_everything_except_must_have": true
                }
            },
            "maintainer": "SUMMAMaintainer"
        }
    }
    ```

    - example maintainer that disables user upload
    ```json
    {
        "hello_world_singularity": {
            "hpc": ["keeling_community"],
            "job_pool_capacity": 5,
            "executable_folder": {
                "from_user": false
            },
            "maintainer": "HelloWorldSingularityMaintainer"
        }
    }
    ```

***

### Community Contributed Application Design
**goal**: develop a Git project framework for community developers to read user input (data and parameters) and interact with maintainer. App developers only need to rewrite their existing code to make it work on HPC with job supervisor. Only one generic maintainer is needed.

**components**

	- param.json: an input file that contains
		1. Executable/data/resulte folders
		2. Job information
		3. Parameters

	- app.json: information about the application
		- app name
		- accepted params
		- DockerHub image/tag (optional)
		- preprocess script
		- pose process script
		- main process script
	- Dockerfile: if provided, build image and deploy on HPC; use when specified
	- preprocess: a script that runs in single thread before the main process
	- main process: runs in MPI
	- pose process: a script that runs in single thread after the main process

***

### Timeline
- ~~MPI - Slurm processing~~
- ~~GitHub download~~
	- ~~write param.json - community contribution~~
	- ~~read app.json - community contribution~~
- ~~preprocess & pose process~~
- ~~Migrate to MySQL - permanent storage~~
- ~~Collect job statistics - monitor~~
- ~~Enable FPT upload and download for local folders - large file upload~~
- ~~User System~~
- ~~Enable Globus on SDK - large file upload~~