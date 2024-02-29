# Revised documentation

## Files, code, and dependencies

The central part of the codebase is the express server defined in `/server.ts`, exposing several endpoints that allow interfacing with and submitting jobs as well as querying about various pieces of info. This file calls upon lots of other code scattered throughout the repository, and these are described below:

### Configs

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
- move all configs to the configs folder
- separate out the example configs from the real ones

### Connectors

These are all defined in the `src/connectors/` directory. A connector in the context of Compute is an object that is meant to abstract away all interactions with the remote HPC **for a given job**. 

There are three total connectors: `BaseConnector`, `SingularityConnector`, and `SlurmConnector`, with `BaseConnector`. The purposes and functionality of these connectors are described below:

- `BaseConnector`: This is the base connector class that all other, more specialized, connectors inherit from. The most fundamental functionality provided here is the ability to execute and get the results of ssh commands executed on remote HPCs. This is implemented through the `node-ssh` package in the `exec` function of the class. This class also has several helper functions for more specific bash functions as well as some functions supporting SCP file transfers between the server and the HPC environment. 

- `SlurmConnector`: This class is a specialization of BaseConnector that allows for the handling of [slurm](https://slurm.schedmd.com/documentation.html) jobs on the HPC. This functionality includes job submission (automatically creating the required slurm templates to do so), job status monitoring/modifications, job Stdout/err queries, and remote folder querying, which all rely on the bash interfacing provided by BaseConnector.

- `SingularityConnector`: This class is a specialization of SlurmConnector that allows for the handling of [singularity](https://docs.sylabs.io/guides/3.5/user-guide/introduction.html) containers, which are essentially packaged, portable pieces of software. This class more or less sits directly on top of SlurmConnector, only providing functions that allow the creation of slurm jobs that will run a singularity image--many of the functions to actually run/monitor a running singularity container are directly inherited from SlurmConnector. This is the connector that is used essentially everywhere.

See `docs/DEVDOC.md` for more information regarding the feature set and customizability of `SlurmConnector` and `SingularityConnector`.

In addition to these two connectors, there is a `ConnectionPool.ts` file. This file creates a `connectionPool` dictionary that tells how to connect to the remote server for a given HPC/job. It also stores how many jobs are currently running on a given HPC.

At the start, `ConnectionPool` only generates ssh configs and `node-ssh` objects for community account HPCs specified in `configs/hpc.json`, which don't require a verified private key for authorized connections. However, `src/Supervisor.ts` can mutate this during the job loop to store connections/credentials for jobs that connect to HPCs that aren't connectable via an authentication-free, community account. These are indexed by job id and are only stored for the duration of the job at question. 

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
- `node-ssh`: enables SSH connections

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
- switch to a more modern & error-friendly sdk for ssh execs

### Utility classes

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
- `GlobusUtil`: This class allows the codebase to use [globus](https://www.globus.org/) for file transfers to and from remote HPCs. The bulk of this code is in the `GlobusUtil` class. This class has functions that allow for the initialization and monitoring of a globus transfer, which is done via some intermediary python scripts. `GlobusTaskListManager`, a custom redis cache, is also implemented within this file to make tracking ongoing globus transfers more easy. The redis database maps folder ids to globus transfer ids.

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
- `JobUtil`: This class provides some helper functions on the job-level for job submissions/slurm config--e.g., validation and parsing/comparing slurm usage of a particular job. It also implements a `ResultFolderContentManager` redis database wrapper to store what things are stored in the result folder for a given job (maps job ids to stringified JSONs). 
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
- update the database to support the new manifest-specific GitUtil things and update everything accordingly
- port all the python globus scripts to the javascript globus SDK & delete `PythonUtil`
- verify `XSEDEUtil` actually does things & is meaningful
- make a RedisUtil class to encapsulate all of the individual redis interfaces (which are essentially the same with a few naming differences)
    - make the redis connections less weird
    - make the redis connection actually persistent and not local
- get an actual git sdk to avoid having to exec
- the Helper generateId function has a chance of collisions (expected 1 in every 62 ** 5 for every millisecond)

### Maintainers

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
- find out why there are missing maintainers
- create more maintainers?

### Models

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

See `docs/DB.md` for more information regarding database schema and table functionality.

Dependencies:

- `typeorm`: the interface allowing these schemas to be defined

Dependents:

- nearly everywhere: used to help with typing & to access the `MySQL` database

Improvements:

- Job may be too bloated
- add other helpful fields to Git repo to support the manifest retrievals

### DB

This class is defined at `src/DB.ts`, and it is essentially a wrapper to support all calls to the database. Its primary function is to store the desired settings/credentials to connect to the TypeORM database, with a function for returning the a database connections object. 

Dependencies:
- `typeorm`: imported for the functions used for creating/managing connections
- `configs/config.ts`: for database settings/credentials
- `src/models/`: to specify what tables are supported with the class

Dependents: essentially everything that interfaces with the database.

Improvements:
- `close` function is useless and does nothing
- disable the clearAll function unless explicitly overwritten
- doesn't necessarily need to be a class, although I can see the motivation for reusing configs

### Emitter

This class is defined at `src/Emitter.ts` and is responsible for abstracting away the emission of events/signals during the job lifecycle. Specifically, it is responsible for interfacing with the Log/Event databses whenever they are requested/mutated.

Dependencies:
- `configs/config`: for testing flags
- `src/DB.ts` & `src/models/`: to connect to the database

Dependents:
- `src/Supervisor.ts`: for registering events regarding job submission statuses and registering logs/events dumped from maintainer instances

Improvements:
    - not sure this needs to be a class; possibly move to lib since it is more utility

### errors & types

These two files (`src/[types, errors].ts`) are essentially big dumps of custom errors/types used throughout the codebase. 

Dependencies:
- `src/models`: for database typings
- `node-ssh`, `ssh2`, `ssh2-streams`: for custom typings

Dependents:
    - nearly everything

Improvements:
    - organize the custom types into categories of usage
    - improve the typings of the custom types to be more clear about what fields are required vs. what are optional (i.e., what is actually reflected in the codebase)
    - move them to another folder (defines?)

### FolderUploader

This file defines a number of folder uploader helpers that are used to send files to remote HPCs. These operate using command-line SCP (via a passed-in connector) or globus (using `GlobusUtil` functions). There are also a number of specializations of foldre uploaders, which are described below:

- `BaseFolderUploader`: the abstract base class from which all folder uploaders are derived. This class encapsulates a singular transfer from the server to a given HPC using a given method, and supports the propogation of changes to folders to the Folder database. The key function of this class is the abstract `upload`, which actually does all the logic for uploading a folder to the HPC, which all children must overwrite. 
- `EmptyFolderUploader`: inherits from `BaseFolderUploader`. This uploader essentially "uploads" an empty folder to the HPC, which is done via a `mkdir` command. 
- `GlobusFolderUploader`: inherits from `BaseFolderUploader`. This uploader varies from all other uploaders in that it utilizes globus for its file transfer, and as such requires globus endpoints to function. This basically serves as a wrapper for the functions defined in `src/GlobusUtil`. 
- `LocalFolderUploader`: inherits from `BaseFolderUploader`. This uploader is the most general uploader, allowing for arbitrary local files to be uploaded to HPCs via use of `FolderUtil` zipping and connector `upload`. 
- `GitFolderUploader`: inherits from `LocalFolderUploader`. This is essentially a `LocalFolderUploader` but directly works with git repositories and the Git database--e.g., it acquires local paths using git ids and supports the refreshing of repos prior to upload.

In addition to these folder uploader specializations, there is also a `FolderUploaderHelper` class that offers a more generalized folder uploader functionality--given an arbitrary input, it decides what folder uploader to create, uploads it, and returns. It should be noted that this helper class is the only folder uploader actually used outside of this file--all calls to folder uploader are abstracted away with this function.

Dependencies:
- `fs` & `path`: for manipulating the file system and paths
- `configs/config.ts`: to get hpc configurations
- `src/connectors/`: connectors are used to do SCP operations
- `src/DB.ts` & `src/models/`: used to update folder information on the Folder database
- `FolderUtil`: for zipping/unzipping functionality
- `GitUtil`: used to get local paths for repos & updating repos
- `GlobusUtil`: required to enable globus uploads
- `src/types.ts`: miscellaneous types used in the folder uploaders

Dependents:
- `src/maintainers/CommunityContributionMaintainer.ts`: used to upload folders required for running a job (only the Git uploader is used)

Improvements:
- better handle how instance variables are inherited to prevent them from appearing too early unnecessarily
    - rework some of the typings
- potentially remove some unused classes
- is there any point in having connectors be passed to it instead of just making a baseconnector
- think if globus transfers of data should be cached

### JupyterHub

This class handles interfacing with arbitrary [JupyterHub](https://jupyter.org/hub) hosts, the environment from which Compute resources are utilized (**?**). In particular, authorization for endpoints is done via JupyterHub authorization, and this class essentially handles extracting key information from JupyterHub authorization tokens.

Dependencies:
- `axios`: used for a GET request to the JupyterHub host to get usernames
- `path`: used for website URL manipulations
- `jupyterGlobusMap`: used for getting configurations for various supported JupyterHub hosts
- `Helper`: null guarding

Dependents:
- `server.ts`: used to help with authorization

Improvements:
- make authorization more clear/robust?

### Queue

This class implements a queue in redis, and it is used primarily to allow the server to keep track of pending jobs to eventually start up. The redis database just stores job ids, using modularized rpush/lpop primarily to implement the queue portion of things. 

This queue coexists with everything else hosted on the redis database, and this is done by having everything in the queue be stored under the same name/key, which is passed in as a parameter for the constructor. 

Dependencies:
- `redis`: needed to support the functions to interface with the redis interface
- `util`: needed to allow the storing of redis commands with promisify
- `configs/config.ts`: used to get redis credentials
- `src/DB.ts` & `src/models/`: used to get job information given ids from the database
- `src/SSHCredentialGuard.ts`: used to handle job credential stores
- `src/types.ts`: used for miscellaneous custom typing

Dependents:
- `src/Supervisor.ts`: directly uses the job queue to keep track of things to create job maintainers for

Improvements:
- combine all redis things into one
- fix the relatively hacky way of storing functions

### SSHCredentialGuard

This file, defined at `src/SSHCredentialGuard.ts`, handles the storing/registering of user-provided SSH connection information. Specifically, there is a function to validate that an SSH key is valid for a given HPC, and there is another function storing the data associated with a given credential id (which is generated randomly). These credential ids are stored in the Job database. To allow for mappings between random ids and the actual data associated with them, a redis key-value store was also implemented in the `CredentialManager` class. 

Dependencies:
- `node-ssh`: for establishing/verifying SSH connections
- `redis`: to implement the key-value store to keep track of credentials
- `util`: for `redis` function storing with `promisify`
- `configs/config.ts`: to get redis credentails
- `src/lib/Helper.ts`: generating random ids for credentials (given the time)
- `src/types.ts`: miscellaneous assorted custom types used for typing

Dependents:
- `src/Queue.ts`: uses this to populate job requests from the database with their associated credentials, if any
- `server.ts`: uses this to verify ssh credential parameters

Improvements:
- actually add some degree of encryption to avoid storing non-encrypted data on databases

### Statistic

This class, defined in `src/Statistic.ts`, provides some useful helper classes for getting statistics relating to both singular Jobs/all jobs. The primary statistic being considered here is total runtime of jobs.

Dependencies:
- `src/DB.ts` & `src/models/`: used to query job runtimes

Dependents:
- `server.ts`: uses this class to get statistics

Improvements:
- possibly coalesce with some more meaningful classes; more of utility class in its current state

### Supervisor

A supervisor, defined in `src/Supervisor.ts`, encodes the logic of the main job loop of the CyberGIS Compute server. It serves as a manager of the higher-level view of job submissions, and there is typically one running per program. To that end, all supervisors have a main indefinite loop created upon construction that handles job instantiation (via maintainers) of all jobs in its queue. Once created, jobs and thier maintainers enter a while loop that starts the job on the HPC and checks/handles when the job finishes.

The main outside-facing function for a supervisor is `pushJobToQueue` (and `cancelJob`), which is used to give the supervisor more things to supervise/handle. Supervisors don't really directly handle outputs (that is more of the job of maintainers), but they do handle job initialization errors, in which the finished time of the job is updated in the database, and also register job events/logs upon finish. 

Dependencies:
- `node-ssh`: used to create new SSH connections for non-community jobs that have their own credentials
- `events`: used for an EventEmitter
- `configs/config.ts`: used to get maintainers/hpc configs along with general configs
- `src/connectors/ConnectionPool.ts`: used for keeping track of the number of jobs on each HPC & for ad-hoc additions of SSH connections for jobs with private credentials
- `src/DB.ts` & `src/models/`: used to connect with the database to log errors with job initialization (and set the respective finishedAt time) and to register job events/logs upon job completion
- `src/Emitter.ts`: used to register events/logs generated during the job maintain cycle
- `src/lib/Helper.ts`: null/assertion checking
- `src/maintainers/BaseMaintainer`: used to allow supervisors to create maintainers for queued jobs
- `src/Queue.ts`: used to implement the job queue of a supervisor
- `src/types.ts`: miscellaneous custom typings used

Dependents:
- `server.ts`: main supervisor created here, starting the main job loop

Improvements:
- fix the code for looking inside the redis queue (it curretnly does not work and needs more redis functionality)
- possibly refactor createMaintenanceWorker to not be busy waiting (change it to setInterval?)

### server.ts

As alluded to earlier, this file creates an `express` server to expose various endpoints allowing for the management of jobs to the outside world. These endpoints handle authorization and draw upon the rest of the codebase (in particular, the supervisor this file instantiates, which serves as the main job handler for the server). This file is what is run to actually start a CyberGIS Compute instance.

Improvements:
- finish/archive the non-implemented endpoints
- declutter things
    - possibly segment endpoints in to categories & create multiple files for endpoint specification

Overall Improvements and TODOs:

- get to all the TODOs
- remove all unneeded ~~packages~~/functions/code
- figure out the purpose of the redis store and possibly archive it
- do full null checking & revamp types accordingly
- full commenting & documentation revamp (mostly done)
- build a rigorous test suite
- update/archive `CVMFS_kernel.md`, `v1_v2_coexisting.md`, `xsede-xkdcdb-api.md`, `FILE_SYS.md`, and `lifecycle.md` to be in-line with this documetation
- get rid of all execs or add better error handling for execs
- add explicit scoping for class functions (protected/public/private)

## Job lifecycle

1. Upon the starting of the CyberGIS Compute server, a new `Supervisor` object is instantiated, which begins running its main loop periodically. 
2. When a job is submitted via the `job/**` endpoints exposed in `server.ts`, it is verified against the job lists in the database, checking that it both exists and is not already submitted. 
3. After verfication, the supervisor has the job pushed to its job queue.
4. During the supervisor's main loop, it will detect that a job is queuing to be submitted onto the desired HPC, and, as such, it will create a `Maintainer` for the job and update job counters accordingly. 
5. The job and its maintainer enter loop in the `createMaintenanceWorker` function, in which the job maintainer `init` function will be called to submit the job to the HPC. 
6. (CommunityContributionMaintainer) In maintainer initialization, the the job's data/git repository will be uploaded into the HPC and the job's executable manifest will be parsed to HPC run settings. After this, the job's output folders will be created, and the job will actually begin running via a slurm command.
7. During the `createMaintenanceWorker` loop, the job's maintainer will have `maintain` called on it repeatedly, which checks for potential errors/whether the job is complete. 
8. On completion, the database is updated accordingly, and the job results (the contents of its output folder) are stored in the `resultFolderContentManager` redis key-value store. The events/logs of the job are also dumped into the database. 


