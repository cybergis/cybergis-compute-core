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

#### SlurmConnector

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
    time: 1,
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
|   #SBATCH --time=${time}
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
await SlurmConnector.submit()
```

4. Get job status

```TypeScript
await SlurmConnector.getStatus()
// returns: C/UNKNOWN -> job finished; R -> job running
```

5. Cancel, pause, and resume

```TypeScript
await SlurmConnector.cancel()
await SlurmConnector.pause()
await SlurmConnector.resume()
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
    time: 1,
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
         this.connector.execCommandWithinImage(this.image_path, `python ${this.connector.getContainerExecutableFolderPath('./main.py')}`, this.slurm)
         // submit job
         await this.connector.submit()
         // emit event
         this.emitEvent('JOB_INIT', 'job [' + this.id + '] is initialized, waiting for job completion')
     } catch (e) {
         this.emitEvent('JOB_RETRY', 'job [' + this.id + '] encountered system error ' + e.toString())
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
          this.emitEvent('JOB_ENDED', 'job [' + this.id + '] finished')
      } else if (status == 'ERROR') {
          // failing condition
          this.emitEvent('JOB_FAILED', 'job [' + this.id + '] failed')
      }
  } catch (e) {
      this.emitEvent('JOB_RETRY', 'job [' + this.id + '] encountered system error ' + e.toString())
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
            "from_user": false
        },
        "maintainer": "HelloWorldSingularityMaintainer"
    }
}
```

6. The full hello world maintainer is at [HelloWorldSingularityMaintainer](https://github.com/cybergis/cybergis-compute-core/blob/v2/src/maintainers/HelloWorldSingularityMaintainer.ts)


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