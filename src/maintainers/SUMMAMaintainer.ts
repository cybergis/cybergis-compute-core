import BaseMaintainer from './BaseMaintainer'

class SUMMAMaintainer extends BaseMaintainer {
    private remote_id

    private remote_slurm_out_file_path

    private remote_model_folder_path

    private local_job_folder_path

    define() {
        this.allowedEnv = {}
    }

    async onInit() {
        var machine = this.manifest.payload.machine === undefined ? 'keeling' : this.manifest.payload.machine
        var node = this.manifest.payload.node === undefined ? 16 : this.manifest.payload.node
        var walltime = this.manifest.payload.walltime === undefined ? 1 : this.manifest.payload.walltime

        var params = await this.runPython('SUMMA/init.py', [
            'cigi-gisolve',
            __dirname + '/../../key/cigi-gisolve.key',
            __dirname + '/../../data',
            'upload/' + this.manifest.uid + '/' + this.manifest.file,
            machine,
            node,
            walltime
        ])

        this.remote_id = params['remote_id']
        this.remote_slurm_out_file_path = params['remote_slurm_out_file_path']
        this.remote_model_folder_path = params['remote_model_folder_path']
        this.local_job_folder_path = params['local_job_folder_path']
    }

    async onMaintain() {
        await this.runPython('SUMMA/maintain.py', [
            'keeling',
            'cigi-gisolve',
            __dirname + '/../../key/cigi-gisolve.key',
            this.remote_id,
            this.remote_slurm_out_file_path,
            this.remote_model_folder_path,
            this.local_job_folder_path
        ])
    }
}

export default SUMMAMaintainer