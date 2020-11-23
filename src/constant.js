"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    destinationMap: {
        summa: {
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
            },
            useUploadedFile: true,
            uploadFileConfig: {
                ignore: [],
                mustHave: [
                    'summa_options.json',
                    'installTestCases_local.sh',
                    'data',
                    'output',
                    'settings'
                ],
                ignoreEverythingExceptMustHave: true
            }
        },
        spark: {
            ip: "hadoop01.cigi.illinois.edu",
            port: 50022,
            maintainer: 'SparkMaintainer',
            jobPoolCapacity: 5,
            isCommunityAccount: false,
            useUploadedFile: true,
            uploadFileConfig: {
                mustHave: [
                    'index.py'
                ]
            }
        },
        wrfhydro: {
            ip: "keeling.earth.illinois.edu",
            port: 22,
            maintainer: 'WRFHydroMaintainer',
            jobPoolCapacity: 5,
            isCommunityAccount: true,
            communityAccountSSH: {
                user: 'cigi-gisolve',
                useLocalKeys: false,
                key: {
                    privateKeyPath: __dirname + '/../key/cigi-gisolve.key',
                    passphrase: null
                }
            },
            useUploadedFile: true,
            uploadFileConfig: {
                ignore: [],
                mustHave: [],
                ignoreEverythingExceptMustHave: false
            }
        },
        helloworld: {
            ip: "keeling.earth.illinois.edu",
            port: 22,
            maintainer: 'HelloWorldMaintainer',
            jobPoolCapacity: 5,
            isCommunityAccount: true,
            communityAccountSSH: {
                user: 'cigi-gisolve',
                useLocalKeys: false,
                key: {
                    privateKeyPath: __dirname + '/../key/cigi-gisolve.key',
                    passphrase: null
                }
            },
            useUploadedFile: true,
            uploadFileConfig: {
                ignore: [],
                mustHave: [
                    "in.txt"
                ],
                ignoreEverythingExceptMustHave: false
            }
        }
    },
    doctorScripts: {
        python: [
            __dirname + '/maintainers/python/SUMMA/doctor.py'
        ]
    }
};
