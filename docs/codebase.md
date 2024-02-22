# Codebase documentation & explanation

The central part of the codebase is the express server defined in `/server.ts`, exposing several endpoints that allow interfacing with and submitting jobs as well as querying about various pieces of info. This file calls upon lots of other code scattered throughout the repository, and these are described below:

## Configs

This refers to the `configs/config.ts` file, which parses and exports all configurations required for Compute to run. The purposes of all of these configuration files are described below:

- `hpcConfigMap`: this settings file provides critical information for working with remote HPCs, including things like ips, ports, HPC type, globus endpoints, and sbatch arguments.
- `jupyterGlobusMap`: this settings file lists all supported jupyterHub servers and their ccorresponding globus endpoints (?)
- `maintainerConfigMap`: lists all the implemented/supported maintainer types and details about them (e.g., what HPCs they can go on)
- `containerConfigMap`: list of supported singularity containers (?)
- `kernelConfigMap`: defines supported python kernels along with their associated environments/packages

Dependencies: the settings files and some custom types
Dependents: nearly everything

Improvements: 
- migrate the configs from json to yaml for a much greater ease of use
- don't export objects -- think of a better way to approach configs
- actually figure out what field are required & not required for configs & update typings accordingly

## Connectors

These are all defined in the `src/connectors/` directory. A connector in the context of Compute is an object that is meant to abstract away all interactions with the remote HPC **for a given job**. 

There are three total connectors: `BaseConnector`, `SingularityConnector`, and `SlurmConnector`, with `BaseConnector`. The purposes and functionality of these connectors are described below:

- `BaseConnector`: This is the base connector class that all other, more specialized, connectors inherit from. The most fundamental functionality provided here is the ability to execute and get the results of ssh commands executed on remote HPCs. This is implemented through the `NodeSSH` package in the `exec` function of the class. This class also has several helper functions for more specific bash functions as well as some functions supporting SCP file transfers between the server and the HPC environment. 

- `SlurmConnector`: This class is a specialization of BaseConnector that allows for the handling of [slurm](https://slurm.schedmd.com/documentation.html) jobs on the HPC. This functionality includes job submission (automatically creating the required slurm templates to do so), job status monitoring/modifications, job Stdout/err queries, and remote folder querying, which all rely on the bash interfacing provided by BaseConnector. 

- `SingularityConnector`: This class is a specialization of SlurmConnector that allows for the handling of [singularity](https://docs.sylabs.io/guides/3.5/user-guide/introduction.html) containers, which are essentially packaged, portable pieces of software. This class more or less sits directly on top of SlurmConnector, only providing functions that allow the creation of slurm jobs that will run a singularity image--many of the functions to actually run/monitor a running singularity container are directly inherited from SlurmConnector. This is the connector that is used essentially everywhere.

In addition to these two connectors, there is a `ConnectionPool.ts` file. This file creates a `connectionPool` dictionary that tells how to connect to the remote server for a given HPC/job. It also stores how many jobs are currently running on a given HPC.

At the start, `ConnectionPool` only generates ssh configs and `NodeSSH` objects for community account HPCs specified in `configs/hpc.json`, which don't require a verified private key for authorized connections. However, `src/Supervisor.ts` can mutate this during the job loop to store connections/credentials for jobs that connect to HPCs that aren't connectable via an authentication-free, community account. These are indexed by job id and are only stored for the duration of the job at question. 

Dependencies:

- `fs`: used to do file I/O to support the creation of dummy files in BaseConnector
- `path`: used mainly for joining file paths
- `configs/config.ts`: used to get HPC information and general information for the hosting server; also for kernel/container configs for `SingularityConnector`
- `src/DB.ts`: provides a reference to mutate the underlying database *(not used)*
- `src/errors.ts`: used for a custom `ConnectorError` on a failed SSH connection
- `src/Helper.ts`: general helper functions (mainly type guards)
- `src/lib/FileUtil.ts`: used for some helpful zipping/local file functions for the host server *(possibly wrong import, FileUtil does not exist)*
- `src/BaseMaintainer.ts`: used to allow the relevant logs to propagate to the maintainer of the connector's job
- `src/types.ts`: various custom types
- `src/connectors/connectionPool.ts`: used to get the SSH configs to open SSH connections
- `NodeSSH`: enables SSH connections

Dependents:

- `src/FolderUploader.ts`: to upload a folder to an HPC, need a connector as an interface
- `src/maintainers/BaseMaintainer.ts`: to maintain a job, need to be able to get info on the status of a slurm job via the connector
- `src/Supervisor.ts` - for jobs using non-community HPCs, need to store login credentials/SSH connections here

Improvements

- ssh connections to each HPC are not initialized within any connectors/the connection pool -- it relies on the connection being estbalisehed and verified within Supervisor.ts first, which may be problematic
- can move some instance variables to down from `BaseConnector` as they are not used in BaseConnector
- can also remove some instance variables -- `db` (no database connection used)
- no connectors are actually explicitly initialized -- they are only created through a maintainer function due to a weird two-way relationship between the two (a maintainer needs a connector, which needs a maintainer)
- many unused functions (particularly specialized shell commands like `ls` in BaseConnector)
- modularize `connectionPool` into a class and make the ability to add in job-specific connections more transparent

## Utility classes

These classes are found in the `src/lib/` directory, and these generally serve as a static helper functions abstracting away more basic operations for other parts of the codebase. The functionalities for each one are described below:

- `FolderUtil`: This class generally deals with files on the local server, providing functions that can zip and unzip folders/files along with functions that can detect if a file is zipped and delete folders/files. 

    - Dependencies:

        - `child_process`: allows the class to spawn a forked child that can run shell commands independently of the main program
        - `fs` & `path`: general file I/O and path manipulations
        - `src/errors.ts`: for custom FileNotExistError

    - Dependents: 

        - `src/FolderUploader.ts`: to handle zipping/unzipping on local file uploads
        - `src/BaseConnector.ts`: for unzipping upon downloading something
        - `src/lib/GitUtil.ts`: unzipping files

- `GitUtil`: This class handles interactions with [github](https://github.com) repositories on the hosting server. It supports things like cloning/refreshing/pulling repositores from the GitHub remote link, and, more importantly, it supports the retrieval and processing of executable manifests stored in job GitHub repositores that describe how a job should be run. 
    - Update: new functions that just `wget` the manifests instead of fully repulling have been added as of commit `e2a4f0`. 
    - Dependencies:
        - `rimraf`: for doing `rm -rf` operations on directories
        - `fs` & `path`: generally file operations and path manipulations
        - `promisify` & `child_process`: used to create a function that does asynchronous shell executions
        - `src/DB.ts` & `src/models/Git`: need to update entries in the `Git` table when things are updated
        - `src/types.ts`: assorted custom types (primarily to support manifest parsing)
    - Dependents:
        - `server.ts`: supports an express route that refreshes manifests
        - `src/FolderUploader.ts`: used to refresh git repositores before upload
        - `src/maintainers/CommunityContributionMaintainer.ts`: used to create executable manifest objects for job submissions
- `GlobusUtil`: This class allows the codebase to use [globus](https://www.globus.org/) for file transfers to and from remote HPCs. The bulk of this code is in the `GlobusUtil` class. This class has functions that allow for the initialization and monitoring of a globus transfer, which is done via some intermediary python scripts. A custom Redis cache, `GlobusTaskListManager` is also implemented within this file to make tracking ongoing globus transfers more easy. 
    - Dependencies:
        - `redis`: needed to implement the globus task manager redis store
        - `promisify`: used with redis to store redis functions to a given database
        - `configs/config.ts`: needed to get redis credentials and globus ids
        - `src/DB.ts`: used to interface with the `globus_transfer_refresh_token` database to get the refresh token associated with an hpc's globus identity
        - `src/types.ts`: import custom functions needed for redis & configs/folders
        - `src/lib/Helper.ts`: for null guard type assertions
        - `src/PythonUtil.ts`: used to actually execute the python scripts that directly interface with globus via the Python SDK
    - Dependents:
        - `server.ts`: needed for a route that gives information regarding globus and to support downloading folders from the server
        - `src/FolderUploader.ts`: used for globus folder uploads between the server and the HPC
- `Helper`: This class contains general helper functions for the entire codebase--for example, a runtime-safe null guard type assertion check. 
    - Dependencies:
        - `configs/config.ts`: needed to access HPC/jupyter globus configs to verify certain things in some functions
        - `src/models/Job.ts`: required to format some job objects
    - Dependents: nearly everything
- `JobUtil`: This class provides some helper functions on the job-level for job submissions/slurm config--e.g., validation and parsing/comparing slurm usage of a particular job. It also implements a `ResultFolderContentManager` to store what things are stored in the result folder for a given job. 
    - Dependencies: 
        - `redis`: to implement the contents of job result folders
        - `promisify`: to enable to storing of redis functions
        - `configs/config.ts`: needed to get some (slurm) properties about HPCs and to get redis credentials
        - `src/DB.ts` & `src/models/Job.ts`: needs to query from the `Job` database to get slurm usage
        - `src/types.ts`: for redis-specific and slurm-related types
    - Dependents:
        - `server.ts`: used for job validation, recording result folder contents, and getting slurm usage
- `PythonUtil`: This class allows Compute to externally run python scripts and record their outputs. This is primarily used for globus transfers via the python globus SDK. 
    - Dependencies:
        - `child_process`: used to run the python programs externally via forking
        - `configs/config.ts`: used for a testing flag controlling print statements
    - Dependents:
        - `src/lib/GlobusUtil.ts`: uses these functions to interface with globus via python scripts
        - `tools/globus-refresh-transfer-token.ts`: also uses these functions to interface with globus via python scripts
- `XSEDEUtil`: This class provides functionality for accessing [XSEDE](https://www.xsede.org/) commands--in particular, it is able to log jobs to XSEDE, given that the HPC in question has the credentials to do so in the config. 
    - Dependencies: 
        - `axios`: required to post to the XSEDE logging url
        - `configs/config.ts`: for a testing flag
        - `src/models/Job.ts` & `src/types.ts`: provides some useful custom typing
    - Dependents:
        - `src/maintainers/CommunityContributionMaintainer.ts`: logs job upon initialization & when maintaining (monitoring the status of) a job

General Improvements

- work out the `folderUtil` vs. `registerUtil` naming discrepancy 
- update the database to support the new specialized manifest functions in `GitUtil`
- port all the python globus scripts to the javascript globus SDK & delete `PythonUtil`
- verify `XSEDEUtil` actually does things & is meaningful
- make a RedisUtil class to encapsulate all of the individual redis interfaces (which are essentially the same with a few naming differences)
    - make the redis connections less weird
- update the database to support the new manifest-specific GitUtil things and update everything accordingly

## Maintainers

A maintainer in Compute is an object that abstracts away and handles everything related to the lifecycle of a job on the HPC. Essentially, for every job, a maintainer is created for it that handles submission, monitoring, and output management. There are two specific maintainers that are implemented, which are described below:

- `BaseMaintainer`: This is an **abstract** class for all maintainers, providing an interface encapsulating all the basic functionality an actual maintainer must implement. In particular, it has abstract functions for defining, initialization (submission), running (the main maintain loop), cancelling, pausing, and resuming a maintainer and its corresponding job. 
- `CommunityContributionMaintainer`: As of 2/22/2024, this is the only current, full implementation of maintainer. In particular, it assumes that the HPC that is being uploaded to is a community HPC supporting Singularity containers (and slurm jobs). 

Dependencies: 

- `validator`: unused
- `configs/config.ts`: used to access testing flags, hpc configs, and maintainer configs
- `src/connectors/`: allows maintainers to actually communicate with HPCs
- `src/DB.ts` & `src/models/*`: used to interface with `Job` repo for updates
- `src/lib/Helper.ts`: general utility (null guarding)
- `src/Supervisor.ts`: unused (supposed to be parent pointer)
- `src/types.ts`: various custom types for configs/events/slurm
- `src/FolderUploader.ts`: used to upload things to the HPC (in `CommunityContributionMaintainer`)
- `src/GitUtil.ts`: used to get executable manifests for a given job (associated with a git repo; in `CommunityContributionMaintainer`)
- `src/lib/JobUtil.ts`: used to have a result folder content manager (unclear whether this is separate or the same as the one in `server.ts`)
- `src/lib/XSEDEUtil`: for job logging to XSEDE

Dependents:

- `src/models/Job.ts`: jobs need to store their maintainer
- `src/connectors/`: connectors store a parent pointer to the maintainer that created them for logging & job info extraction
- `src/Supervisor.ts`: on job processing, need to create a maintainer for them (done via a hacky constructor-extraction way)

Improvements:
- decide concretely whether some of these instance variables should be undefined or not; remove unused instance variables
    - move instance variables down to specialized classes
- rework/remove the getXConnector functions (maybe just give it the emitter for job logging it needs?)
- standardize (and formalize via data hiding?) the OnX and supervisor-facing functions

## Models

These are all found in `src/models/` and define the schema of various tables in our `MySQL` database recording critical information to the application. `typeorm` is used to fully define these schema. The tables defined here and their purposes are described below:

- `Event`: this table stores all events pertaining to jobs as they go through their lifecycle in Compute
    - columns: (event) id, jobId, type (of event), message, createdAt, updatedAt, deletedAt
- `Folders`: this table stores information about folders on the remote HPC
    - columns: (folder) id, name (null), hpc (that the folder is on), hpcPath (path to the folder on the HPC), globusPath, userId (what user the folder is associated with), isWritable, createdAt, updatedAt, deletedAt
- `Git`: this table stores information about the supported Github repositories from which jobs can be created
    - columns: id (name of the repo), address (url of the repo), sha (commit hash), isApproved, createdAt, updatedAt, deletedAt
- `GlobusTransferRefreshTokens`: stores globus refresh tokens that are needed for globus transfers (?)
    - columns: identity (who the refresh token belongs to), transferRefreshToken (actual token), createdAt, updatedAt, deletedAt
- `Job`: this table stores information about submitted jobs
    - columns: id, userId (who submitted it), name (?), maintainer (which maintainer it is using), hpc (what hpc it will/is run on), localExecutableFolder (where to access the code to run), localDataFolder (where to access the data), param (parameters for the job), env (parameters for the environment in which the job will run), slurm (slurm info), slurmId, credentialId (for SSHing), updatedAt, deletedAt, initializedAt, finishedAt, queuedAt, isFailed, nodes, cpus, cpuTime, memory,, memoryUsage, walltime, remote[Executable, Data, Result]FolderId (foreign keys to Folder)
- `Log`: like events, but stores general logs for jobs instead
    - columns: (event) id, jobId, message, createdAt, updatedAt, deletedAt
- `Migrations`: not implemented

Dependencies:

- `typeorm`: the interface allowing these schemas to be defined

Dependents:

- nearly everywhere: used to help with typing & to access the `MySQL` database

Improvements:

- Job may be too bloated
- add other helpful fields to Git repo to support the manifest retrievals




