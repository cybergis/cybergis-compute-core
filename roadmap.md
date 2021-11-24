# CyberGIS HPC Job Supervisor v2 Roadmap
By Zimo Xiao
***
## Problem
#### Legacy Job Submission System
Running algorithms on HPC requires `Slurm` as job scheduler and `Singularity ` for running containerized environment.  In Job Supervisor v1 (current), interaction with Slurm and Singularity is done through a legacy Python package developed  by Drew and Fangzhen (). The package supports job submission to Keeling and Comet XSEDE. Though, the package has some **disadvantages**: 
	- Entry code is based on Jupyter UI
	- Extra connection layers that are machine specific (ex. Keeling)
	- Hardcoded executables and data file parsers that project specifict
	- Package is independent from job monitor system
		- hard to integrate and collect logs
	- Learning barrier for developing new submission service is hard

#### Missing User System
The current system grants access to community account without authenticating the user, exposing valuable computing resources to the public. This is caused by the architecture not having a user system. Without a user system, administrators cannot prevent users outside a whitelist or an organization to gain access.

#### Lack of Community Contribution 
To add a new service, a user has to create a singularity image, upload it to HPC, write a maintainer in NodeJS, and write a job submission connector in Python in Jupyter-XSEDE. The makes it impossible for users, even skilled ones, to create job submission services.

#### Cannot Transfer Large File
The current system only supports 100MB of file upload. For security reason, we don’t want users to have direct access to a community account, and upload to the machine. So every file has to proxy through the job submission system.

***

## Solution
#### Integrate Slurm Support in Maintainer
A new SSH/SFTP based `SlrumConnector Class` is implemented in maintainer. Is supports native SSH support as well as Slurm operations. `SlurmConnector` only supports submitting **singularity** jobs.

- Pure SSH connector `BaseConnector` is defined as:
```typescript
class BaseConnector {
	/** SSH operators **/
	async connect(env = {})
	async disconnect()
	async exec(commands: string | Array<string>, options: options = {}, continueOnError = false, mute = false)
	/** file operators **/
	async download(from: string, to: LocalFolder)
	async upload(from: LocalFolder, to: string)
}
```

- Slurm connector `SlurmConnector` is based on `BaseConnector ` and is defined as:
```typescript
class SlurmConnector {
	prepare(image: string, cmd: string, config: slurm)
	async submit()
	async getStatus(mute = false) // UNKNOWN | C
	async cancel()
	async pause()
	async resume()
	getExecutableFilePath()
}
```

- SBATCH Scheduler Parameters are defined as:
```typescript
interface slurm {
    time?: number,
    num_of_node?: number,
    num_of_task?: number,
    cpu_per_task?: number,
    memory_per_cpu?: string
    gpu_per_task?: number
}
```

#### Compatibility Issue
> ⚠️ with a few API changes, the new architecture makes it harder to support old maintainers that are developed with Jupyter-XSEDE.
> **Solution**: create an adaptive layer that translate old API and allow old maintainers to run.

***

#### User System
The plan is to implement a user system with email and OTP (One-Time-Password). A token is generated (saved locally in JSON format) for the user to recreate the `User` object from SDK. The new architecture has the following new workflow:
- A `User` contains an authenticator (email)
	- authenticated by OTP and tokens
- A `User` have access to `hpc` resources
	- **pattern**: allow access by user attribute
		- ex. allow all users with email that ends with *@illinois.edu*
	- **whitelist/groups**: add user to whitelist or group (?)
- A `hpc` resource is defined as:
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
        "connector": "SlurmConnector",
        "root_path": "/tmp"
    }
}
```

- A `maintainer` can have many `hpc` resources:
```json
{
    "SUMMA": {
        "hpc": ["keeling_community", "comet"],
		  ...
        "maintainer": "SUMMAMaintainer"
    }
}
```

- A `User` can create `Job`
- `Job` can also be created individually
```python
Job(hpc=None, maintainer=None, id=None, user=None, password=None, url="cgjobsup.cigi.illinois.edu", port=443, isJupyter=False, protocol='HTTPS')
```
- A token is generated for the `Job` to maintain access

#### Compatibility Issue
> ⚠️ new design removed `Session` and added `User`. The causes incompatibility between the old and new SDK. There are also some API changes that makes it impossible for the old SDK to work with the new one.
> **Solution**: maintain the old API, old code still remains in master branch and new code in a `v2` development branch. Expose the new version in a different port. Implement `Job` first, allow time for code change.

***

#### Large File Transfer
The new system separates a project file into executable files and data files
- **executable files** are small, and only contain code and necessary model/config files.
	- executable files can be uploaded to job supervisor
		- or downloaded from GitHub or other git services
- **data files** are large, and requires direct upload
	- services like Globus/Git/SFTP/Hadoop that a user can directly upload to and pulled from HPC side, no proxy needed.
- Both data files and executable files are mounted in the container 
```
--bind [exec_file]:[job_id] --bind [data_file]:[job_id]/data
```

***

#### Community Contribution 
We don’t want users to write maintainer or build to own image. We just want users to write their project, upload, and run. We can achieve that by building a generic image with a generic maintainer. Example: a Python singularity image that is pre-installed with common packages. 

A great image to have is CyberGISX conda environment container. It is essentially the same environment as CyberGISX, allow users to upload their notebook to HPC and run.

#### Proposal for Community Contribution 
One idea of allowing user contribution is through GitHub. User can contribute their code in GitHub repo. Users can email us or submit through online form. The source code is reviewed by our team. 
To prevent dangerous code being submitted after review, a **specific commit hash and branch** are used to pull only the commits that are verified.  Other users can specify the executable file to the GitHub link and run the Community Contributed code on HPC. 
> 📢 Generic images can run anything on it. So we only allow verified Github project to be submitted to HPC

Example:
- a Python singularity image
	- with packages preinstalled
- a maintainer that only allows a list of GitHub links to be submitted as executable files
	- ex. [github://zimo-xiao/project-a, github://zimo-xiao/project-b]
- to use the code, user submit as:
```js
{
	maintainer: "python-cybergisx",
	hpc: "keeling",
	file: "github://zimo-xiao/project-a",
	data_file: {
		"": "globus://"
	},
	app: {	// application parameters
		"a": "value",
		"b": "value"
	}
}
```
- for code contributors
	- a file called `entry.sh` act as the entry script on HPC
	- the maintainer writes all application parameters into a file called `params.json` for the application to read.
	- stdout and stderr are logged

***

## Current Progress
- implemented Slurm Connector
- implemented `Job` object
- rewrite architecture to allow future development 
- rewrite SDK to support new API

## Urgent work
- implement maintainer for Alex’s model
- write adaptive layer to allow old maintainers to run
- implement Globus or other large file non-proxied transfer solution

## Future work: before summer
- user system
- migrate all old maintainers to new one
- community contribution
