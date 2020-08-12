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
 - Service is defined in `src/constant.ts`. There are three types:
   - private account services:
   - > In this mode, user uses their own Linux account & password to login and submit jobs to a remote terminal
```js
serviceName: {
    ip: "hadoop01.cigi.illinois.edu",
    port: 50022,
    maintainer: 'ExampleMaintainer',
    capacity: 5,
    isCommunityAccount: false
}
```
  - community account using local key:
  - > In this mode, a local private key is defined in config.json, usually under ~/.ssh. User login to community account using the machine's private-public key pairs
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
  - community account using custom key:
  - > In this mode, a custom private key is copied under ./key. Define the location of the private key and the passphrase associated with the key. User login to community account using the custom private-public key pairs
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

#### Define MaintainerClass

Add a new **Maintainer** class under `./src/maintainers` which extends the `BaseMaintainer` class
```JavaScript
import BaseMaintainer from './BaseMaintainer'

class ExampleMaintainer extends BaseMaintainer {
    // your code
}
```

The lifecycle of a **Maintainer** class is defined as the following:

  1. `onInit()` method is called when a job first enters the job execution pool. The method is supposed to initialize the running environment before the job execution (copy script, install packages, setup environment variables, etc.).
     -  The `Supervisor` invoke the `onInit()` method and stop when received a `JOB_INITIALIZED` event emitted by the `Maintainer`. 
     - If the method finished running yet never emitted a `JOB_INITIALIZED` event, the `Supervisor` will rerun the script until initialization success.
     - `onInit()` should always emit `JOB_INITIALIZED` event when initialization is completed.

  2. `onMaintain()` method is called when a job initialization is finalized. The method is supposed to check the status of the job.
     - The `Supervisor` invoke the `onMaintain()` method and stop when received a `JOB_ENDED` or `JOB_FAILED` event emitted by the `Maintainer`. 
     - `onMaintain()` should always emit `JOB_ENDED` or `JOB_FAILED` event when job is completed or failed in remote terminal.

