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
            }
        },
        examplePrivateAccountService: {
            ip: "keeling.earth.illinois.edu",
            port: 22,
            maintainer: 'SUMMAMaintainer',
            jobPoolCapacity: 5,
            isCommunityAccount: false
        },
        exampleCommunityAccountUsingLocalKey: {
            ip: "keeling.earth.illinois.edu",
            port: 22,
            maintainer: 'SUMMAMaintainer',
            jobPoolCapacity: 5,
            isCommunityAccount: true,
            communityAccountSSH: {
                user: 'cigi-gisolve',
                useLocalKeys: true
            }
        }
    }
};
