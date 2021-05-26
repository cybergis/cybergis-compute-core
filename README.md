# CyberGIS Compute Job Supervisor Server
v2 is in development. For future features and roadmap, please refer to [CyberGIS HPC Job Supervisor v2 Roadmap]().

## Content
- []

***

## Server Setup
0. Requirements
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

4. Run server
    ```bash
    # for production server only
    ./script/production-start.sh

    # for development
    # - run in foreground with log output
    ./script/development-start.sh
    # - run in background, add -b background failing
    ./script/development-start.sh -b
    # - some HPC requires university network
    # - to connect to a University VPN, add the AnyConnect options
    ./script/development-start.sh -l vpn.cites.illinois.edu -u NetID -p "password" -g 5_SplitTunnel_NoPrivate
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

- **FileSystem**: a file system for maintainers to create files or accept user upload
  - **Folder**: a file folder that represents a 
- **Connector**: a SSH connection for maintainer to send request and receive data from remote HPC servers
- **Maintainer**: maintaining process that submits jobs and monitors process
  - **onDefine**: a function called first to set parameters 
  - **onInit**: a function called to submit jobs
  - **onMaintain**: a function called to monitor jobs, stop when job ends or failed
- **Executable Folder**: a folder of files that contain only executables (file size: small)
- **Data Folder**: a folder of files that contain data (file size: large)
- **Result Folder**: a folder of files that contain result of the job run (file size: large)

***

## Singularity Hello World Development

#### SlrumConnector

This connector generates, runs, and monitors remote slurm job

1. Import Slurm Modules

```TypeScript
SlurmConnector.registerModules(['python', 'purge'])
/** translates to:
|   module load python
|   module load purge
*/
```

2. Compile slurm options and command into a slurm job

```TypeScript
// user will provide config when submit
var config = {
    walltime: 1,
    num_of_node: 1,
    num_of_task: 1,
    cpu_per_task: 1,
    memory_per_cpu: '2G'
}

SlurmConnector.prepare('python hello_world.py', config)
/** translates to:
|   #!/bin/bash
|   #SBATCH --job-name=${this.jobID}
|   #SBATCH --nodes=${config.num_of_node}
|   #SBATCH --ntasks=${config.num_of_task}
|   #SBATCH --cpus-per-task=${config.cpu_per_task}
|   #SBATCH --mem-per-cpu=${config.memory_per_cpu}
|   #SBATCH --time=${walltime}
|   #SBATCH --error=${path.join(this.remote_result_folder_path, "slurm.stdout")}
|   #SBATCH --output=${path.join(this.remote_result_folder_path, "slurm.stdout")}
|
|   module load python
|   module load purge
|   python hello_world.py
*/
```

3. Submit slurm job

```TypeScript
await SlrumConnector.submit()
```

4. Get job status

```TypeScript
await SlrumConnector.getStatus()
// returns: C/UNKNOWN -> job finished; R -> job running
```

5. Cancel, pause, and resume

```TypeScript
await SlrumConnector.cancel()
await SlrumConnector.pause()
await SlrumConnector.resume()
```

#### SingularityConnector

This connector is built on top of SlurmConnector and support all slurm operations. On top of slurm operations, it also support the following.

1. register volume binds

```TypeScript
SingularityConnector.registerContainerVolumeBinds({
    '/path/on/hpc': '/path/in/image'
})
```

2. run image

```TypeScript
var config = {
    walltime: 1,
    num_of_node: 1,
    num_of_task: 1,
    cpu_per_task: 1,
    memory_per_cpu: '2G'
}

// execute command within an image: singularity exec [image] [cmd]
SingularityConnector.execCommandWithinImage('/path/to/image.img', 'python hello_world.py', config)
// run the image: singularity run [image]
SingularityConnector.runImage('/path/to/image.img', config)
```

#### Write a hello world job!

1. First write a hello world python script to run
```python
import time
print("{{content}}") # {{content}} is replaceable
time.sleep(5) #sleep for 5 seconds
print("job complete!")
```

2. Define a connector

```TypeScript
onDefine() {
  this.connector = this.getSingularityConnector()
}
```

3. Upload the script to HPC, and submit the job

```TypeScript
 async onInit() {
     try {
         var replacements = {content: "hello world"} // replace {{content}} with "hello world"
         // create file name main.py
         this.executableFolder.putFileFromTemplate(this.entry_script_template, replacements, 'main.py')
         // execute the python script
         this.connector.execCommandWithinImage(this.image_path, `python ${this.connector.getContainerExecutableFolderPath('./main.py')}`, this.manifest.slurm)
         // submit job
         await this.connector.submit()
         // emit event
         this.emitEvent('JOB_INIT', 'job [' + this.manifest.id + '] is initialized, waiting for job completion')
     } catch (e) {
         this.emitEvent('JOB_RETRY', 'job [' + this.manifest.id + '] encountered system error ' + e.toString())
     }
 }
```

4. Get job status, if complete, end job

```TypeScript
async onMaintain() {
  try {
      var status = await this.connector.getStatus()
      if (status == 'C' || status == 'UNKNOWN') {
          await this.connector.getSlurmOutput()
          // ending condition
          await this.connector.rm(this.connector.getRemoteExecutableFolderPath()) // clear executable files
          this.emitEvent('JOB_ENDED', 'job [' + this.manifest.id + '] finished')
      } else if (status == 'ERROR') {
          // failing condition
          this.emitEvent('JOB_FAILED', 'job [' + this.manifest.id + '] failed')
      }
  } catch (e) {
      this.emitEvent('JOB_RETRY', 'job [' + this.manifest.id + '] encountered system error ' + e.toString())
  }
}
```

5. Don't forget to register your maintainer in `config/maintainer.json` and `config/maintainer.example.json`

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

6. The full hello world maintainer is at [HelloWorldSingularityMaintainer]()
