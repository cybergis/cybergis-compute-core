# Job Supervisor
HPC job submission and maintaining framework with Restful API

## Setup a Supervisor Server
0. Requirements
    - NodeJS + npm/yarn
    - Python3.4+ + pip3

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

3. Run doctor script to check if Bash/Python dependencies are install correctly
    ```bash
    node ./doctor.js
    ```

4. Run server in background
    ```bash
    node ./cli.js run
    ```

## Development
0. Setup
 - The project uses TypeScript. Please install `tsc` command for code compile.
```bash
npm install -g typescript
```
- to compile TypeScript into JavaScript, simply run:
```bash
tsc
```

1. Add Service
 - Service is defined in `src/constant.ts`:
```js
hadoop: {
    ip: "hadoop01.cigi.illinois.edu",
    port: 50022,
    maintainer: 'ExampleMaintainer',
    capacity: 5,
    isCommunityAccount: false,
    communityAccountUser: 'hadoop'
}
```

2. MaintainerClass
- 