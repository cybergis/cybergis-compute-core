import SingularityConnector from '../connectors/SingularityConnector'
import BaseMaintainer from './BaseMaintainer'
import { LocalFile } from '../FileSystem'

export default class HelloWorldSingularityMaintainer extends BaseMaintainer {

    public connector: SingularityConnector

    public downloadFile: LocalFile

    private entry_script_template = `
import time
print("{{content}}") # {{content}} is replaceable
time.sleep(5) #sleep for 5 seconds
print("job complete!")
`

    private entry_script_file_name = 'main.py'

    private image_path = '/data/keeling/a/cigi-gisolve/simages/spatialaccess.simg'

    onDefine() {
        // define connector
        this.connector = this.getSingularityConnector()
    }

    async onInit() {
        try {
            var replacements = {content: "hello world"}
            this.executableFile.putFromTemplate(this.entry_script_template, replacements, this.entry_script_file_name)
            // executables are always mounted to /job_id
            this.connector.execCommandWithinImage(this.image_path, `python /${this.id}/${this.entry_script_file_name}`, this.manifest.slurm)
            await this.connector.submit()
            this.emitEvent('JOB_INIT', 'job [' + this.manifest.id + '] is initialized, waiting for job completion')
        } catch (e) {
            this.emitEvent('JOB_RETRY', 'job [' + this.manifest.id + '] encountered system error ' + e.toString())
        }
    }

    async onMaintain() {
        try {
            var status = await this.connector.getStatus()
            if (status == 'C' || status == 'UNKNOWN') {
                await this.connector.getSlurmOutput()
                // ending condition
                await this.connector.rm(this.connector.getRemoteExecutableFilePath()) // clear executable files
                this.emitEvent('JOB_ENDED', 'job [' + this.manifest.id + '] finished')
            } else if (status == 'ERROR') {
                // failing condition
                this.emitEvent('JOB_FAILED', 'job [' + this.manifest.id + '] failed')
            }
        } catch (e) {
            this.emitEvent('JOB_RETRY', 'job [' + this.manifest.id + '] encountered system error ' + e.toString())
        }
    }

    async onPause() {
        await this.connector.pause()
    }

    async onResume() {
        await this.connector.resume()
    }

    async onCancel() {
        await this.connector.cancel()
    }
}
