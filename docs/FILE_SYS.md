# CyberGIS Folder System Proposal
**Mission Statement:** we need an independent folder management system in which users can:
- create a folder on HPC
- upload files into a folder using Globus or other methods (ex. SSH upload)
- rename a folder
- use a folder as input data in a job
- share folders to others
- delete folders from HPC

## Data Model
`Folder` is an abstract class on the Compute Core that records a folder's system/globus location on an HPC.
```typescript
class Folder {
    id: string

    name: string

    hpc: string // host HPC

    hpcPath: string // system path on host HPC

    globusPath: string // globus path on host HPC

    isWritable: boolean // set the folder to readable or writeable
}
```

When used by a `Job`, it is referenced using many-to-one relation.
```typescript
class Job {
    remoteExecutableFolder: Folder

    remoteDataFolder: Folder

    remoteResultFolder: Folder
}
```

To create a `Folder`, you have to upload your folder's content using the `FolderUploader` classes:
- `EmptyFolderUploader`
- `GlobusFolderUploader`
- `LocalFolderUploader`
- `GitFolderUploader`

### Propose APIs
1. Currently, the only way to create a new folder is to submit a new job. We need to add APIs to allow users to create folders without using a job.
    - Propose API -> POST /folder/upload/globus
2. We should allow users to list the file structure of the Folder, similar to doing a `ls` on the machine.
    - Propose API -> GET /folder/<folder_id>/list
3. Right now, there's no way to modify (delete/add) the file content of a folder.
   - Propose API -> PUT /folder/<folder_id>/upload/globus?path=/some/path
   - Propose API -> DELETE /folder/<folder_id>/delete?path=/some/path

## Propose UI Changes
1. Add a new tab on the CyberGIS-Compute SDK for managing folders
   1. In the new tab, we have a dropdown in which you can select the folder you want to access.
   2. Once you click on a folder, you can:
      - Give it a name
      - Delete it
      - Show a tree like diagram of the file structure
        - delete certain files by clicking a button next to the file/folder name
        - Add a new file by clicking a button next to the folder name
2. Add toggle button in the data file upload part of the Job submission tab. It should allow user choose weather the user want to provide their own data (upload) or use a preexisting folder.
   - For selecting folders, show a dropdown of the user owned folders
   - When a folder is selected, show a tree like file structure of the content inside the folder.
   - Show a textbox for users to add outside folders by typing the folder's id.