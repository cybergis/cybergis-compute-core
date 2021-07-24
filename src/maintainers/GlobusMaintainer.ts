import BaseMaintainer from './BaseMaintainer'

class GlobusMaintainer extends BaseMaintainer {
    private remote_id;

    define() {
        this.allowedEnv = {}
    }

    async onInit() {

        var jobid = this.getJobID();

        var params = await this.runPython('Globus/init.py', [
            jobid,
             __dirname + '/../../data/upload/' + this.manifest.uid + '/' + this.manifest.file,
        ]);


        this.globus_task_id = params['globus_task_id'];
        this.globus_task_label = params['globus_task_label'];

    }

    async onMaintain() {
        await this.runPython('Globus/maintain.py', [
            this.getJobID(),
            this.globus_task_id,
            this.globus_task_label,
        ])
    }
}

export default GlobusMaintainer