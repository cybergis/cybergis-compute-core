# CyberGIS-Compute Core Lifecycle
The **core** is a middleware server that sits between **JupyterLab Environments** (ex. CyberGISX) and **HPCs**. It bridge the computing power of HPCs with the user-friendly UI of JupyterLab.

 to bring the computing power of HPC to 

:
1. Exposes a set of RESTful APIs to users
2. Execute commands on HPC according to user's request

***

The server architecture is divided into:
1. **Server Space**: exposes a set of RESTful API interfaces, handles authentication
2. **Maintainer Pool**: automated processes that manages HPC jobs
3. **Connector Pool**: shared SSH connection between server and HPCs

***

## Build Project
Before you build you code, you should install all dependencies using `npm i`. Then, simply run `npm run build` to build your project. All compiled code are under the `/production` folder.

***

## Server Space

### RESTful APIs
The RESTful APIs are constructed using [ExpressJS](http://expressjs.com), a lightweight JavaScript web framework. All server code is defined in a single file [/server.ts](https://github.com/cybergis/cybergis-compute-core/blob/v2/server.ts). This file is also responsible for [constructing all the components](https://github.com/cybergis/cybergis-compute-core/blob/7048cebf3aa6b80e6667572ec10b704a102ff790/server.ts#L39) and acts as the entrypoint for CyberGIS-Compute. Just run `node /production/server.js` to start the Compute-Core.

### Authorization
CyberGIS-Compute Core has two sets of authentication systems:
1. Job tokens: represents a job submission.
2. JupyterLab Auth: native JupyterLab API  token, [see doc](https://jupyterhub.readthedocs.io/en/stable/reference/rest.html).

***