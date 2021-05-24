# CyberGIS HPC Job Supervisor
v2 is in development. For future features and roadmap, please refer to [CyberGIS HPC Job Supervisor v2 Roadmap]().

## Content
- []

***

## Production Server Setup
0. Requirements
    - NodeJS & npm
    - Docker & Docker Compose

1. Initialize
    ```bash
    git clone https://github.com/cybergis/job-supervisor.git
    cd job-supervisor
    # run init script
    ./script/init.sh
    ```

2. Configure the following options
   - config.json
     - `local_key`
       - `private_key_path`
       - `passphrase` (if required)
     - `local_file_system`
       - `cache_path`
       - `root_path`
   - configs/hpc.json
     - `external_key`
       - `private_key_path`
       - `passphrase` (if required)

3. Run production server
    ```bash
    ./script/production-start.sh
    ```

***

##  Development Setup
0. System requirements
    - NodeJS & npm
    - Docker & Docker Compose

1. Install TypeScript
    ```bash
    npm install -g typescript
    ```

2. Initialize
    ```bash
    git clone https://github.com/cybergis/job-supervisor.git
    cd job-supervisor
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

4. Run development server
    ```bash
    ./script/development-start.sh
    ```
    > ⚠️ use Ctrl+C to exit

5. If you are outside the University network, use AnyConnect options to start the development server
    ```bash
    ./script/development-start.sh -l vpn.cites.illinois.edu -u NetID -p "password" -g 5_SplitTunnel_NoPrivate
    ```

6. Stop all running containers
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
                "from_user_upload": true,
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
                "from_user_upload": false
            },
            "maintainer": "HelloWorldSingularityMaintainer"
        }
    }
    ```

***

## Development Terminologies

- FileSystem: a file system for maintainers to create files or accept user upload
  - File: a file folder that represents a 
- Connector: 

***

## Singularity Hello World Development

- Singularity Connector