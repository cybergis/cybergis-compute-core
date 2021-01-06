# A Quick Start for Model Developer
This is a quick-start tutorial for developers who want to add new models to the Job Supervisor (one core component of the CyberGIS Computing Service)
<img width="1028" alt="Screen Shot 2020-08-12 at 3 37 04 PM" src="https://user-images.githubusercontent.com/34933627/90065330-bad40280-dcb1-11ea-8e8c-4edfd3eb8987.png">

## Content
- [Setup a Supervisor Server](https://github.com/cybergis/job-supervisor#setup-a-supervisor-server)
- [Restful API](https://github.com/cybergis/job-supervisor#restful-api)
- [General Development Guidelines](https://github.com/cybergis/job-supervisor#general-development-guidelines)
  - [Development Environment Setup](https://github.com/cybergis/job-supervisor#development-environment-setup)
  - [Add Service](https://github.com/cybergis/job-supervisor#add-service)
  - [User Upload File](https://github.com/cybergis/job-supervisor#user-upload-file)
  - [Define Maintainer Class](https://github.com/cybergis/job-supervisor#define-maintainer-class)
- [Future Roadmap](https://github.com/cybergis/job-supervisor#future-roadmap)


## Setup local development environment
0. Requirements
    - Linux or macOS (not tested on Windows)
    - Anaconda 3 or Miniconda 3
    - VPN to UofI network (if not on campus)
    - A developer ssh key to Keeling HPC (see below)
    
1. Setup a local development environment
    ```bash
    # make local folders as workspace
    # folder "jobsupdev" is for repos (will check out later)
    # fodler "jobsupdev/notebooks" is for example notebooks
    mkdir -p ~/jobsupdev/notebooks
    
    # check out Job Supervisor repo
    cd ~/jobsupdev
    git clone https://github.com/cybergis/job-supervisor.git
    
    # create conda virtual environment "jobsupdev"
    cd job-supervisor
    conda env create -f environment_dev.yml
    
    # activate virtual environment "jobsupdev"
    > ⚠️ all the following steps should be finished under virtual environment "jobsupdev"
    conda activate jobsupdev
   
    # checkout major dependency cybergis library (hosted in repo Jupyter-xsede)
    cd ~/jobsupdev
    git clone https://github.com/cybergis/Jupyter-xsede.git
    # install in dev mode
    cd Jupyter-xsede
    python setup.py develop
    
    # setup redis
    cd ~/jobsupdev/job-supervisor
    # start redis locally (may need to accept a warning on macOS)
    redis-server --daemonize yes
    # to stop: redis-cli shutdown
    
    # configs and ssh key
    cp config.example.json config.json
    # put developer ssh key file (cigi-gisolve.key) in "~/jobsupdev/job-supervisor/key/"
    > ⚠️ developer should request for a key file and keep it secured
    # !! Do Not share ssh key file with others or commit to GitHub !!
    
    # check dependency
    node ./doctor.js
   
    # start Job Supervisor (node.js server) locally
    node ./cli.js serve
    # to stop: node ./cli.js background stop-all
   
    # quick checkup
    # open browser and visit http://localhost:3000/
    # it should return {"message":"hello world"} 
    # log is at ~/jobsupdev/job-supervisor/log/
    ```

## HelloWorld Model

The HelloWorld model is a toy model implemented in the Job Supervisor. It serves as an example for developers who want to add new models to the Job Supervisor. 
The only required input of this model is a file named "in.txt" where users can put arbitrary multi-line plan text. 
The model reads in the content of "in.txt" and inserts text "Hello World !" on the first line. 
It then writes out the updated content to file "out.txt". 

There is also a HelloWorld notebook (helloworld.ipynb), which is the entry point for developers and users to debug and test the HelloWorld model.
Before we dive into the implementation of model, we run the HelloWorld notebook to get a sense on how the final thing works.

0. HelloWorld notebook

    Make a copy of the example notebook helloworld.ipynb
    
    ```bash
    cd ~/jobsupdev
    cp job-supervisor/examples/helloworld/helloworld.ipynb notebooks/
    
    # start jupyter server locally 
    jupyter notebook
    # access jupyter environment at http://localhost:8888
   
    # run helloworld.ipynb
    ```
   The notebook prepares the required input file "in.txt" and submits it to the local dev Job Supervisor instance. 
   Job Supervisor then executes the model on a HPC resource (Keeling in this case).
   When execution is completed, the notebook retrieves result and displays it. 
   As mentioned above, the expected model output is in file 'out.txt'.

1. Job Supervisor Service VS. CyberGIS library and 2-Layer design VS. 3-Layer design
  
   The implementation of a new model in Job Supervisor Service often requires code changes to at least 2 separate projects: Job Supervisor (repo name: job-supervisor) and CyberGIS (repo name: Jupyter-xsede).
   The "CyberGIS" is a Python-based implementation of the legacy 2-layer job submission system in which model jobs are submitted to HPC resources directly from user's Python environment (like Jupyter).
   Despite its simplicity in design and implementation, it may pose potential maintenance and security issues.
   
   To overcome some the issues and bring in more flexibility supporting various model and computing resources, a new 3-layer job submission system, Job Supervisor, was designed and implemented. 
   The Job Supervisor encapsulates job submission-related features in a standalone web service based on Node.JS.
   It serves as a gateway between the end-user environment (like Jupyter) and the HPC resources such that users submit model jobs to Job Supervisor and then Job Supervisor relays jobs to HPC for execution.
   Although the new Job Supervisor has re-implemented most of the essentials implemented in the 2-layer CyberGIS library, it didnt replicate the logic that supports specific models.
   Instead, the Job Supervisor can run as a wrapper and call existing features in the CyberGIS library as needed.
   This approach ensures the existing codes are reused to the best extent. 
   Also, it can minimize the impact of coding language change as Node.JS uses TypeScript while majority of domain model developers are more familiar with Python.
   
   Here is the comparison on the workflow of the 2-layer and 3-layer design, from which the roles of Job Supervisor Service and CyberGIS library could be better illustrated.
   
   1-a. 2-Layer Job Submission Workflow (using CyberGIS lib only)
   
   User prepares and configures model inputs in Jupyter --> Users calls CyberGIS lib to initiate the job submission to HPC --> CyberGIS lib runs in the following steps
   
| Step\Location | Jupyter (local)==> | HPC (remote) |
|---|---|---|
|  1 | CyberGIS to make a local copy of model folder; generate job submission scripts (SBatch and others) |   | 
|  2 | CyberGIS to zip up model folder and upload to HPC  | receive zipped model package  |
|  3 |  CyberGIS to log into HPC to |  unzip model package; call SBatch script to schedule the execution; return HPC job id|
|  4 | CyberGIS to receive job id and Jupyter to remember it  |  |
|  5 | CyberGIS to periodically log into HPC| to check job status |
|  6 | CyberGIS to log into HPC to download model results |  |
|  end |  | |

   1-b. 3-Layer Job Submission Workflow (using Job Supervisor Service + CyberGIS lib + Job Supervisor Python SDK) 

   User prepares and configures model inputs in Jupyter --> Users calls Job Supervisor SDK (Python REST client) lib to initiate job submission process 
   
| Step\Location | Jupyter (local)==> | Job Supervisor Service (remote)==> | HPC (remote) |
|---|---|---|---|
|1|SDK (Job Supervisor Python SDK) to create or restore a session to the Service (Job Supervisor Service)|---|---|
|2|SDK to zip up model and upload to Service|receive model files|---|   
|3|SDK to submit additional parameters (what model? which HPC? how many cpus? ...) |start job submission process to HPC by calling CyberGIS lib|---|
|4| | CyberGIS to make a local copy of model folder; generate job submission scripts (SBatch and others) | |
|5| | CyberGIS to zip up model folder and upload to HPC| receive zipped model package|
|6| | CyberGIS to log into HPC to|unzip model package; call SBatch script to schedule the execution; return HPC job id|
|7| | CyberGIS to receive job id and Service to remember it| |
|8| SDK to periodically ask Service about job status| Service to periodically call CyberGIS  | to check job status on HPC |
|9| | Service to call CyberGIS to log in HPC| to download model results|
|10| |Service to stage model results and mark job as done| | |
|11|SDK to download model results from Service| | |
|end| |||

   As shown above, the steps 4-9 in the 3-Layer design are almost equivalent to the steps 1-6 in the 2-Layer workflow.
   But the caller that organizes and executes in 3-layer is the Job Supervisor Service instead of Jupyter (or user).
   
   In general, most of the coding work required for adding a new model would be done to the CyberGIS library in Python.
   Some minor code changes to the Job Supervisor in TypeScript would be needed to expose the newly added model through the web service.
   In some cases, additional changes to other libraries might also be required such as the Job Supervisor Python SDK (repo name: job-supervisor-python-sdk), which provides a collection of Python wrappers for the REST endpoints exposed by the Job Supervisor web service.
   
2. HelloWorld model implementation in CyberGIS library

   The complete HelloWorld model implementation involved code changes to both the CyberGIS library and the Job Supervisor. 
   As stated above, the majority work to add a new model usually happens to the CyberGIS library.
   Specifically for the HelloWorld model, three files were added or changed in the CyberGIS library: helloworld.py, helloworldSupervisor.py and __init__.py

   a. helloworld.py
   
   https://github.com/cybergis/Jupyter-xsede/blob/5a82c2a97e4010361bae434d6d745b7d8908db37/cybergis/helloworld.py
   
   For every HPC resource a model is expected to run on, three concrete classes should be implemented: a class represents Scheduling Script, a class represents User Script, and a class represents the model Job.
   
   A Scheduling Script is a shell script that runs on the target HPC to submit the job to HPC scheduler for execution.
   
   A User Script is called by the Scheduling Script to invoke the actual model, which can be in the form of a standalone binary executable, a script or even the User Script itself (the case of the HelloWorld model). 
   Although a User Script can be written in any language (shell, Python or others), developer should make sure the environment and dependencies required to run the User Script are all prepared in the Scheduling Script.
   In the case of the HelloWorld model, since the model body is directly implemented in the User Script in Python without using any third party library, the only required environment is the default Python interpreter on the target HPC.
   For complex models, developer should pre-install required environment on HPC and load it in the Scheduling Script before calling the User Script. 
   There are different ways to do it. Although a thorough discussion on this topic is out of the scope of this tutorial, we recommend using Singularity container technology, and developers can, if interested, refer to Singularity's official website at https://sylabs.io/docs/ and implementation of the SUMMA model at https://github.com/cybergis/Jupyter-xsede/blob/master/cybergis/summa.py#L25.
    
   A Job class coordinates the whole workflow including preparations of the Scheduling Script and the User Script, file and data transfer, monitoring and others.
   
   If the target HPC resources use same or compatible job scheduling system, the three classes listed above are usually reusable through class inheritance with minor modification.
   The current implementation of the HelloWorld model supports execution on Keeling HPC (also called Virtual Roger; hosted at UIUC) and COMET HPC (a XSEDE resource hosted at SDSC).
   Since both Keeling and COMET use Slurm scheduler, the implementation for HelloWorld model were first done in Keeling-related classes and are then ported to COMET classes easily.
   We will only focus on Keeling implementation here, and developers are encouraged to go through COMET implementation.
   
   For Keeling, the three required classes are HelloWorldKeelingSBatchScript, HelloWorldUserScript and HelloWorldKeelingJob;
   
   a-1. Scheduling Class: HelloWorldKeelingSBatchScript
   
   HelloWorldKeelingSBatchScript subclassed KeelingSBatchScript with "file_name" and "SCRIPT_TEMPLATE" overridden.
   "file_name" is the filename and "SCRIPT_TEMPLATE" is the content of the sbatch script being written to disk.
   There are several variables in SCRIPT_TEMPLATE" denoted in form of "$XXXXX" (with leading $ sign), which will be replaced by corresponding real values in runtime.
   An special case is the variable with double leading '$' signs, such as $$SLURM_JOB_NODELIST in this case. 
   It will be replaced by $SLURM_JOB_NODELIST (with one $ sign removed) in runtime to be used as a SLURM environment variable (see: https://slurm.schedmd.com/sbatch.html).
   The line that invokes the actual model run is "python helloworld.py $remote_model_folder_path/in.txt $remote_model_folder_path/output/out.txt".
   "helloworld.py" is generated by User Script, "$remote_model_folder_path/in.txt" and "$remote_model_folder_path/output/out.txt" are the two parameters passed into "helloworld.py" representing the input file path and output file path respectively.
   
```python
    HELLOWORLD_SBATCH_SCRIPT_TEMPLATE = \
    '''#!/bin/bash
    
    #SBATCH --job-name=$job_name
    #SBATCH --ntasks=$ntasks
    #SBATCH --time=$walltime
    
    ## allocated hostnames
    echo "Compute node(s) assigned: $$SLURM_JOB_NODELIST"
    python helloworld.py $remote_model_folder_path/in.txt $remote_model_folder_path/output/out.txt
    
    cp slurm-$$SLURM_JOB_ID.out $remote_model_folder_path/output
    '''
    
    class HelloWorldKeelingSBatchScript(KeelingSBatchScript):
        file_name = "helloworld.sbatch"
        SCRIPT_TEMPLATE = HELLOWORLD_SBATCH_SCRIPT_TEMPLATE
```
    
   An example of the final "helloworld.sbatch" file is:
      
```bash
    #!/bin/bash
    
    #SBATCH --job-name=HelloWorld
    #SBATCH --ntasks=1
    #SBATCH --time=01:00:00
    
    ## allocated hostnames
    echo "Compute node(s) assigned: $SLURM_JOB_NODELIST"
    python helloworld.py /data/cigi/scratch/cigi-gisolve/HelloWorld_1609873227CuPW/16098732271rjR/in.txt /data/cigi/scratch/cigi-gisolve/HelloWorld_1609873227CuPW/16098732271rjR/output/out.txt
    
    cp slurm-$SLURM_JOB_ID.out /data/cigi/scratch/cigi-gisolve/HelloWorld_1609873227CuPW/16098732271rjR/output

```
    
    
   a-2. User Script Class: HelloWorldUserScript
   
   HelloWorldUserScript subclassed BaseScript. Similarly, it will write the content defined in SCRIPT_TEMPLATE into a file named "helloworld.py".
   As said above, the userscript "helloworld.py" is the model body in this case, and will be executed by the SBatch script above.
   
```python
    HELLOWORLD_USER_SCRIPT_TEMPLATE = \
    '''
    import os
    import sys
    # input_file
    in_path = sys.argv[1]
    # output_file
    out_path = sys.argv[2]
    with open(in_path, "r") as fin:
        input = fin.readlines()
    output_dir = os.path.dirname(out_path)
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
    with open(out_path, "w") as fout:
        fout.write("Hello World!" + os.linesep)
        fout.writelines(input)
    ''' 
    
    class HelloWorldUserScript(BaseScript):
        file_name = "helloworld.py"
        SCRIPT_TEMPLATE = HELLOWORLD_USER_SCRIPT_TEMPLATE
```
   
   a-3 Job Class: HelloWorldKeelingJob
   
   HelloWorldKeelingJob subclassed SlurmJob. job_name gives the model a unique name "HelloWorld"; sbatch_script_class references the SBatch class HelloWorldKeelingSBatchScript.
   The method "def prepare(self)" will be called in Step-4 in the 3-layer design (Step-1 in 2-layer design) to create SBatch scripts and user Scripts.
   The method "def download(self)" is only used in 2-layer design. The 3-layer download method is in another source file (see helloworldSupervisor.py below).
   The logic for other steps listed above are implemented in different base classes. For complex modes, developer may need to go override some inherited method for further customization.
   
```python
    class HelloWorldKeelingJob(SlurmJob):
        job_name = "HelloWorld"
        sbatch_script_class = HelloWorldKeelingSBatchScript
    
        def prepare(self):
            # save SBatch script
            self.sbatch_script.generate_script(local_folder_path=self.local_job_folder_path,
                                               _additional_parameter_dict=self.to_dict())
            # save user scripts
            user_script = HelloWorldUserScript()
            user_script.generate_script(local_folder_path=self.local_job_folder_path,
                                        _additional_parameter_dict=self.to_dict())
        def download(self):
            # only used in 2-layer job submission
            pass
```
   b. helloworldSupervisor.py
   
   https://github.com/cybergis/Jupyter-xsede/blob/master/cybergis/helloworldSupervisor.py
   
   The purpose is provide necessary interface for the classes in helloworld.py to talk to the Job Supervisor Service.
   HelloWorldSupervisorToHPC subclassed BaseSupervisorToHPC to provide concrete classes linked to supported HPC resources. In this case, it supports 2 HPC: Keeling and COMET,
   and each of them requires 2 classes: one for SBatch and one for Job as implemented above.
   
   The baseclass "BaseSupervisorToHPC" has methods to carry our the actions describled in 3-Layer workflow, including "def submit(self, **kargs)" for job submission; "def job_status(self, remote_id)" for checking job status on HPC;
    "def download()" for downloading files from HPC to Service server. Developer may need to override some of them methods in the baseclass for further customizations.
   
   
```python
    class HelloWorldSupervisorToHPC(BaseSupervisorToHPC):
        _KeelingSBatchScriptClass = HelloWorldKeelingSBatchScript
        _KeelingJobClass = HelloWorldKeelingJob
        _CometSBatchScriptClass = HelloWorldCometSBatchScript
        _CometJobClass = HelloWorldCometJob
```
   
   c. __init__.py
   
   https://github.com/cybergis/Jupyter-xsede/blob/master/cybergis/__init__.py
   
   In the __init__.py, the classes in helloworld.py and helloworldSupervisor.py are exposed.
   
```python
    # ....code snippet....
    from .helloworld import *
    from .helloworldSupervisor import *
```
   
3. HelloWorld model implementation in Job Supervisor (in TypeScript and Python)  

Only the basic concepts and steps to implement the HelloWorld model are covered here. 
Although most of the steps are reusable in other models, developers are encourage to go through doc at https://github.com/cybergis/job-supervisor/blob/master/README.md 
for more detailed descriptions on design of Job Supervisor.


|Step\Library|Maintainer==>|Python helper scripts==>|CyberGIS library|
|---|---|---|---|
|1|Maintainer's OnInit() method invoked when HelloWorld job first comes in|||
| |OnInit() to call python/HelloWorld/init.py with necessary parameters passed in|init.py to call CyberGIS lib (helloworldSupervisor.py)|CyberGIS to start job submission to HPC |
| |Maintainer to remember parameters (job id etc) returned from CyberGIS lib||
|2|OnMaintain() invoked periodically to monitor job status|||
| |OnMaintain() to call python/HelloWorld/maintain.py necessary parameters passed in|maintain.py to call CyberGIS lib (helloworldSupervisor.py)| CyberGIS to check job status and download model results from HPC to Job Supervisor Service|
| | Maintainer to remember which model result file on Job Supervisor can be downloaded by Jupyer/User| |  |
|end| | | |


Each supported model in Job Supervisor is represented as a Maintainer. All files and parameters passed in from the Jupyter (user Python environment) 
are accessible to Maintainer. Maintainer typically goes through two actions in sequence: onInit() and onMaintain(). onInit() is invoked when a job first enters Job Supervisor pool.
which should start the job submission process to HPC by calling an external script. In this case, HelloWorldMaintainer calls a Python script "init.py", which in turn calls the class "HelloWorldSupervisorToHPC" defined in "helloworldSupervisor.py" in the CyberGIS lib mentioned above.
HelloWorldMaintainer passes all necessary parameters to HelloWorldSupervisorToHPC so it can submit the HelloWorld model to HPC.
Also, HelloWorldMaintainer should capture the output from


In this case, Maintainer calls Python scripts to invoke the actual job submission process i
   
 