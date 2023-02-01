
# Tables

## Event
    

Represents a job event
    
Cols:
-   id (primary generated column): number
-   jobID: string, jobID of the job associated with this event
-   type: String, the type of event being described
-   message: String, error message returned describing this event
-   job: job, the job running when this event occurred
-   createdAt: Date, when this event was created
-   updatedAt: Date, when this event was last updated
-   deletedAt: Date, the time at which this event was deleted
    

Functions:
-   setCreatedAt(): Sets createdAt to current time, returns createdAt
-   setUpdatedAt: sets updatedAt to curr time, returns updatedAt
    
    
Who accesses & calls it:
-   It is accessed via the job object, server.ts will access a specific job’s events with the /job/:jobid/events route
- Job contains a list of events, sorted by createdAt


## Folder
    

Represents a folder
    
Cols:
- id: Number, primary generated col
- name: String, name of the folder (nullable)
- hpc: String, hpc associated with the job whose results are in this folder
- hpcPath: String, path to this folder on the HPC
- globusPath: String, path to the globus container
- userId: String, id of the user whose job generated this folder
- isWritable: Boolean (default false), if the folder is writable or not
- createdAt: Date, when this folder was created
- updatedAt: Date, when this folder was last updated
- deletedAt: Date, the time at which this folder was deleted

Functions:
-   setCreatedAt(): Sets createdAt to current time, returns createdAt
-   setUpdatedAt: sets updatedAt to curr time, returns updatedAt

Who accesses & calls it:
- Folders can be accessed by job. Each job contains a list of the associated remoteExecutableFolder, remoteDataFolder, and remoteResultFolder
- Also accessed via /folder route, which accesses the folders associated with the userid of the requester
    
## Git
    
Represents a git action
    
Cols:
- id: Number, primary generated column
- address: String, address of the git repository
- sha: String, sha hash of a user token for the repo
- isApproved: Boolean, if the repository is approved to run
- createdAt: Date, when this was created
- updatedAt: Date, when this was last updated
- deletedAt: Date, the time at which this was deleted

Functions:
-   setCreatedAt(): Sets createdAt to current time, returns createdAt
-   setUpdatedAt: sets updatedAt to curr time, returns updatedAt

Who accesses & calls it:
- Accessed in server.ts (initHelloWorldGit())
- Accessed in server.ts with route /git. Attempts to clone the git repo in the manifest
    

## GlobusTransferRefreshToken
Represents a globus transfer refresh token
    
Cols:
- (Primary) identity: String, primary generated col
- transferRefreshToken: String, actual refresh token sent to globus
 - createdAt: Date, when this token was created
- updatedAt: Date, when this token was last updated
- deletedAt: Date, the time at which this token was deleted

Functions:
-   setCreatedAt(): Sets createdAt to current time, returns createdAt
-   setUpdatedAt: sets updatedAt to curr time, returns updatedAt

Who accesses & calls it:


## Job
Job to be run on an hpc

Cols:
- id: String, primary generated column
- userId: String, user who submitted the job
- maintainer: String, maintainer associated with the job
- hpc: String, name of the HPC the job was submitted to
- remoteExecutableFolder: Folder, remote executable folder associated with the job, if any (nullable)
- remoteDataFolder: Folder, remote data folder associated with the job, if any (nullable)
- remoteResultFolder: Folder, remote result folder associated with the job, if any (nullable)
- localExecutableFolder: JSON containing LocalFolder, GitFolder, GlobusFolder, path to local executable folder (nullable)
- localDataFolder: JSON containing NeedUploadFolder, location of the local data folder, if any (nullable)
- param: list, list of parameters the job needs to run (nullable)
- env: list (nullable)
- slurm: list, list of slurm parameters for the job (nullable)
- slurmId: String, slurmId for this job to run on the HPC
- credientialId: String, credential needed to run this on the specified HPC
- events: Event[], all events associated with this job
- logs: Log[], all logs associated with this job
 - createdAt: Date, when this job was created
- updatedAt: Date, when this job was last updated
- deletedAt: Date, the time at which this job was deleted
- initializedAt: Date, time at which this job was initialized
- finishedAt: Date, time at which this job finished runnning
- isFailed: Boolean, if the job failed or not
- Nodes: Number, number of nodes needed for this job to run
- cpus: Number, number of cpus needed for this job to run (slurm specification)
- cpuTime: Number, time needed on each cpu (slurm specification)
- memory: Number, amount of memory that should be allocated for this job to run (slurm specification)
- memoryUsage: Number, predicted amount of memory used (slurm specification)
- walltime: Number, time from start to end of the job

Functions:
- setCreatedAt(): Sets createdAt to current time, returns createdAt
- setUpdatedAt: sets updatedAt to curr time, returns updatedAt
- sortLogs(): Sorts logs by createdAt
- sortEvents(): Sorts events by createdAt



Who accesses & calls it:
- Modify in server.ts /job/:jobId
- This class serves as a go-between at times between different cols like event and the user. 

## Log
Columns:
- id: String, default generated column
- jobId: jobid of the job associated with this log
- job: Job, the job this log is tied to
- createdAt: Date, when this log was created
- updatedAt: Date, when this log was last updated
- deletedAt: Date, the time at which this log was deleted

Functions:
- setCreatedAt(): Sets createdAt to current time, returns createdAt
- setUpdatedAt: sets updatedAt to curr time, returns updatedAt

Who accesses & calls it:
   
-   Job contains a list of logs, sorted by createdAt
    
-   Via the job object, server.ts will access a specific job’s logs with the /job/:jobid/logs
