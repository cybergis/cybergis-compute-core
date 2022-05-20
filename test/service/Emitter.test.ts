import 'jest'
import TestHelper from '../TestHelper'
import Emitter from '../../src/Emitter'
import { config } from '../../configs/config'
import DB from '../../src/DB'
const db = new DB()

beforeAll(() => {
    config.is_jest = true
})

afterEach(async () => {
    await db.clearAll()
})

const jobId = 'test-job'
const userId = 'test-user'
const secretToken = 'abcdefg'
const maintainer = 'community_contribution'
const hpc = 'keeling_community'

const eventType = 'test-event'
const eventMessage = 'I am testing this event'

const logType = 'test-event'
const logMessage = 'I am testing this log'

describe('test Emitter.getEvents', () => {
    const emitter = new Emitter()

    test('simple get event', async () => {
        const job = await TestHelper.createJob(jobId, userId, secretToken, maintainer, hpc)
        const createdEvent = await TestHelper.createEvent(job, eventType, eventMessage)
        const queriedEvents = await emitter.getEvents(job.id)
        //
        expect(queriedEvents.length).toEqual(1)
        expect(queriedEvents[0].jobId).toEqual(job.id)
        expect(queriedEvents[0].id).toEqual(createdEvent.id)
        expect(queriedEvents[0].type).toEqual(createdEvent.type)
    })

    test('get events', async () => {
        const eventsCount = 10
        const job = await TestHelper.createJob(jobId, userId, secretToken, maintainer, hpc)
        for (var i = 0; i < eventsCount; i++) await TestHelper.createEvent(job, `${eventType}_${i}`, `${eventMessage}_${i}`)
        const queriedEvents = await emitter.getEvents(job.id)
        //
        expect(queriedEvents.length == eventsCount)
        for (var i = 0; i < eventsCount; i++) {
            expect(queriedEvents[i].jobId).toEqual(job.id)
            expect(queriedEvents[i].type).toEqual(`${eventType}_${i}`)
        }
    })
})

describe('test Emitter.getLogs', () => {
    const emitter = new Emitter()

    test('simple get log', async () => {
        const job = await TestHelper.createJob(jobId, userId, secretToken, maintainer, hpc)
        const createdLog = await TestHelper.createLog(job, logMessage)
        const queriedLogs = await emitter.getLogs(job.id)
        //
        expect(queriedLogs.length).toEqual(1)
        expect(queriedLogs[0].jobId).toEqual(job.id)
        expect(queriedLogs[0].id).toEqual(createdLog.id)
        expect(queriedLogs[0].message).toEqual(createdLog.message)
    })

    test('get logs', async () => {
        const logsCount = 10
        const job = await TestHelper.createJob(jobId, userId, secretToken, maintainer, hpc)
        for (var i = 0; i < logsCount; i++) await TestHelper.createLog(job, `${logMessage}_${i}`)
        const queriedLogs = await emitter.getLogs(job.id)
        //
        expect(queriedLogs.length == logsCount)
        for (var i = 0; i < logsCount; i++) {
            expect(queriedLogs[i].jobId).toEqual(job.id)
            expect(queriedLogs[i].message).toEqual(`${logMessage}_${i}`)
        }
    })
})

describe('test Emitter.registerLogs', () => {
    const emitter = new Emitter()

    test('simple register log', async () => {
        const job = await TestHelper.createJob(jobId, userId, secretToken, maintainer, hpc)
        await emitter.registerLogs(job, `${logMessage}_register_${0}`)
        await emitter.registerLogs(job, `${logMessage}_register_${1}`)
        const queriedLogs = await emitter.getLogs(job.id)
        expect(queriedLogs.length).toEqual(2)
        expect(queriedLogs[0].jobId).toEqual(job.id)
        expect(queriedLogs[1].jobId).toEqual(job.id)
        expect(queriedLogs[0].message).toEqual(`${logMessage}_register_${0}`)
        expect(queriedLogs[1].message).toEqual(`${logMessage}_register_${1}`)
    })
})

describe('test Emitter.registerEvents', () => {
    const emitter = new Emitter()

    test('simple register events', async () => {
        const job = await TestHelper.createJob(jobId, userId, secretToken, maintainer, hpc)
        await emitter.registerEvents(job, `${logType}_register_${0}`, `${logMessage}_register_${0}`)
        await emitter.registerEvents(job, `${logType}_register_${1}`, `${logMessage}_register_${1}`)
        const queriedEvents = await emitter.getEvents(job.id)
        expect(queriedEvents.length).toEqual(2)
        expect(queriedEvents[0].jobId).toEqual(job.id)
        expect(queriedEvents[1].jobId).toEqual(job.id)
        expect(queriedEvents[0].type).toEqual(`${logMessage}_register_${0}`)
        expect(queriedEvents[1].type).toEqual(`${logMessage}_register_${1}`)
    })
})