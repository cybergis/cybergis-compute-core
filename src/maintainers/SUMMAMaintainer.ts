import SingularityConnector from '../connectors/SingularityConnector'
import BaseMaintainer from './BaseMaintainer'
import { LocalFolder } from '../FileSystem'

export default class SUMMAMaintainer extends BaseMaintainer {

    public connector: SingularityConnector

    public resultFolder: LocalFolder

    public executableFolder: LocalFolder

    private entry_script_template = `
import json
import os
import numpy as np
from mpi4py import MPI
import subprocess
import pysumma as ps

comm = MPI.COMM_WORLD
rank = comm.Get_rank()
size = comm.Get_size()
hostname = MPI.Get_processor_name()

print("{}/{}: {}".format(rank, size, hostname))

job_folder_path = "$singularity_job_folder_path"
instance = "$model_folder_name"
instance_path = os.path.join(job_folder_path, instance)
json_path = os.path.join(job_folder_path, instance, "summa_options.json")

workers_folder_name = "workers"
workers_folder_path = os.path.join(job_folder_path, workers_folder_name)

if rank == 0:
    os.system("mkdir -p {}".format(workers_folder_path))
comm.Barrier()

try:
    with open(json_path) as f:
        options_dict = json.load(f)
except:
    options_dict = {}
options_list = [(k,v) for k,v in options_dict.items()]
options_list.sort()
groups = np.array_split(options_list, size)
config_pair_list = groups[rank].tolist()

# copy instance folder to workers folder
new_instance_path = os.path.join(workers_folder_path, instance + "_{}".format(rank))
os.system("cp -rf {} {}".format(instance_path, new_instance_path))
# sync: make every rank finishes copying
subprocess.run(
    ["./installTestCases_local.sh"], cwd=new_instance_path,
)
comm.Barrier()

# file manager path
file_manager = os.path.join(new_instance_path, 'settings/summa_fileManager_riparianAspenSimpleResistance.txt')
print(file_manager)
executable = "/code/bin/summa.exe"

s = ps.Simulation(executable, file_manager)
# fix setting_path to point to this worker
s.manager["settingsPath"].value = s.manager["settingsPath"].value.replace(instance_path, new_instance_path) 
s.manager["outputPath"].value = os.path.join(instance_path, "output/")

# Dont not use this as it rewrites every files including those in original folder -- Race condition
#s._write_configuration()

# Instead, only rewrite filemanager
s.manager.write()

if len(config_pair_list) == 0:
    config_pair_list = [("_test", {})]
for config_pair in config_pair_list:

    try:
        name = config_pair[0]
        config = config_pair[1]
        print(name)
        print(config)
        print(type(config))
        
        # create a new Simulation obj each time to avoid potential overwriting issue or race condition
        ss = ps.Simulation(executable, file_manager, False)
        ss.initialize()
        ss.apply_config(config)
        ss.run('local', run_suffix=name)
        print(ss.stdout)
    except Exception as ex:
        print("Error in ({}/{}) {}: {}".format(rank, size, name, str(config)))
        print(ex)

comm.Barrier()
print("Done in {}/{} ".format(rank, size))`

    private entry_script_file_name = 'run_summa.py'

    private image_path = '/data/keeling/a/cigi-gisolve/simages/pysumma_ensemble.img_summa3'

    onDefine() {
        // define connector
        this.connector = this.getSingularityConnector()
    }

    async onInit() {
        try {
            this.executableFolder.chmod('installTestCases_local.sh', '755')
            this.executableFolder.putFileFromTemplate(this.entry_script_template, {}, this.entry_script_file_name)
            // executables are always mounted to /job_id
            this.connector.execCommandWithinImage(this.image_path, `python ${this.connector.getRemoteExecutableFolderPath(this.entry_script_file_name)}`, this.slurm)
            await this.connector.submit()
            this.emitEvent('JOB_INIT', 'job [' + this.id + '] is initialized, waiting for job completion')
        } catch (e) {
            this.emitEvent('JOB_RETRY', 'job [' + this.id + '] encountered system error ' + e.toString())
        }
    }

    async onMaintain() {
        try {
            var status = await this.connector.getStatus()
            if (status == 'C' || status == 'UNKNOWN') {
                // ending condition
                await this.connector.getSlurmOutput()
                this.resultFolder = this.fileSystem.createLocalFolder()
                await this.connector.download(this.connector.getRemoteExecutableFolderPath(), this.resultFolder)
                this.emitEvent('JOB_ENDED', 'job [' + this.id + '] finished')
            } else if (status == 'ERROR') {
                // failing condition
                this.emitEvent('JOB_FAILED', 'job [' + this.id + '] failed')
            }
        } catch (e) {
            this.emitEvent('JOB_RETRY', 'job [' + this.id + '] encountered system error ' + e.toString())
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
