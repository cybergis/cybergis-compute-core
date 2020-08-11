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
        var params = await this.runPython('SUMMA/init.py', [
            'cigi-gisolve',
            __dirname + '/../../key/cigi-gisolve.key',
            __dirname + '/../../data/SUMMA'
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