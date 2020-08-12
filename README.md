# Job Supervisor
HPC job submitting and maintaining framework with Restful API

## Setup a Supervisor Server
0. Requirements
    - NodeJS & npm/yarn
    - Python3.4+ & pip3

1. Install Job Supervisor
    ```bash
    git clone https://github.com/cybergis/job-supervisor.git
    cd job-supervisor
    npm install
    ```

2. Configure
    ```bash
    cp config.example.json config.json
    ```

3. Run doctor script to check if Bash/Python dependencies are correctly installed
    ```bash
    node ./doctor.js
    ```

4. Run server in background
    ```bash
    node ./cli.js serve
    ```

## General Development Guidelines
#### Development Environment Setup
 - The project uses TypeScript. Please install `tsc` command for compiling TypeScript to JavaScript.
```bash
npm install -g typescript
```
- to compile TypeScript into JavaScript, simply run:
```bash
tsc
```

#### Add Service
Service is defined in `src/constant.ts`. There are three types:
private account services:
> Users use their own Linux account & password to login and submit jobs to a remote terminal
```js
serviceName: {
    ip: "hadoop01.cigi.illinois.edu",
    port: 50022,
    maintainer: 'ExampleMaintainer',
    capacity: 5,
    isCommunityAccount: false
}
```
community account using local key:
> A local private key is defined in config.json, usually under ~/.ssh. User login to community account using the machine's private-public key pairs
```js
serviceName: {
    ip: "keeling.earth.illinois.edu",
    port: 22,
    maintainer: 'SUMMAMaintainer',
    jobPoolCapacity: 5,
    isCommunityAccount: true,
    communityAccountSSH: {
        user: 'cigi-gisolve',
        useLocalKeys: true
    }
}
```
community account using custom key:
> A custom private key is copied under ./key. Define the location of the private key and the passphrase associated with the key. User login to community account using the custom private-public key pairs
```js
serviceName: {
    ip: "keeling.earth.illinois.edu",
    port: 22,
    maintainer: 'SUMMAMaintainer',
    jobPoolCapacity: 5,
    isCommunityAccount: true,
    communityAccountSSH: {
        user: 'cigi-gisolve',
        useLocalKeys: false,
        key: {
            privateKeyPath: __dirname + '/../key/cigi-gisolve.key',
            passphrase: null
        }
    }
}
```

#### Define Maintainer Class

Add a new **Maintainer** class under `./src/maintainers` which extends the `BaseMaintainer` class
```JavaScript
import BaseMaintainer from './BaseMaintainer'

class ExampleMaintainer extends BaseMaintainer {
    // your code
}
```

The lifecycle of a **Maintainer** class is defined as the following:

  1. `onInit()` method is called when a job first enters the job execution pool. The method is supposed to initialize the running environment before the job execution *(copy script, install packages, setup environment variables, etc.)*.
     -  The `Supervisor` invoke the `onInit()` method and stop when received a `JOB_INITIALIZED` event emitted by the `Maintainer`. 
     - If the method finished running yet never emitted a `JOB_INITIALIZED` event, the `Supervisor` will rerun the script until initialization success.
     - `onInit()` should always emit `JOB_INITIALIZED` event when initialization is completed.

  2. `onMaintain()` method is called when a job initialization is finalized. The method is supposed to check the status of the job.
     - The `Supervisor` invoke the `onMaintain()` method and stop when received a `JOB_ENDED` or `JOB_FAILED` event emitted by the `Maintainer`. 
     - `onMaintain()` should always emit `JOB_ENDED` or `JOB_FAILED` event when job is completed or failed on remote terminal.

Maintainer Interface:
  - **user define methods**
    - `define()`: *(optional)* define allowed system environment variables when connected to the remote terminal
    - `await onInit()`: *[async]* initialize job
    - `await onMaintain()`: *[async]* monitor job status
  - **helper methods**
    - `this.emitLog(message: string)`: emit log
    - `this.emitEvent(type: string, message: string)`: emit event
    - `await this.runPython(file: string, args?: Array<string>): any{}`: *[async]* run python script
      - **file**: name of the python script under `src/maintainers/python`
      - **args**: array of arguments passed in to the python script
        - use `sys.argv[i]` to receive argument
      - **magic python syntax**:
        - by printing the following string in your python script, the python process is able to communicate back with the maintainer.
          - `print('@log=[example log msg]')`: emit a log to `Maintainer`
          - `print('@event=[EVENT_NAME:event message]')`: emit an event to `Maintainer`
          - `print('@var=[NAME:value]')`: define an output of the `runPython()` class.
    - `await this.connect(cmdPipeline: Array<any>, ?options: options)`: *[async]* execute BASH commands in sequence on remote terminal
      - **cmdPipeline**: an array of strings or anonymous functions
        - string: a command to execute (ex. `echo $A`)
        - anonymous function: a function that receives 
      - **options**:
```JavaScript
export interface options {
    cwd?: string,
    execOptions?: any,
    encoding?: BufferEncoding
}
```