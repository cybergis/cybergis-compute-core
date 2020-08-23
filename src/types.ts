export interface rawAccessToken {
    alg: string,
    payload: {
        encoded: string,
        decoded: any
    },
    hash: string
}

export interface secretToken {
    usr: string,
    sT: string
}

export interface manifest {
    aT?: string,
    cred?: {
        usr: string,
        pwd: string
    },
    uid?: number,
    id?: string,
    maintainer?: any,
    dest: string,
    env: any,
    payload: any,
    file?: any
}

export interface aT {
    aT: string,
    cred?: {
        usr: string,
        pwd: string
    },
    uid?: number,
    file?: any,
    dest: undefined // hack
}

export interface secretTokenCache {
    cred: {
        usr: string,
        pwd: string
    },
    dest: string,
    sT: string
}

export interface options {
    cwd?: string,
    execOptions?: any,
    encoding?: BufferEncoding
}