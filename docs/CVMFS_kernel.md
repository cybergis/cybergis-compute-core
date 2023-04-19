# Adding CVMFS Kernels

- Assumes that you have a working singcvmfs executable.

- Any new kernels need to be added to `configs/kernel.example.json`.

- The key represents the name of the kernel that you would like the user to use in their `manifest.json`.

- The `env` field contains all of the lines that would be executed in a bash script while calling the container (`createKernelInit`).

- Unless you really know what you are doing, its recommended to copy paste the template from the other kernels and just swap the kernel names.