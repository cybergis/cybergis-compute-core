import { manifest } from './types'

class Queue {
    private queue = []

    push(item: manifest) {
        this.queue.push(item)
    }

    shift() {
        return this.queue.shift()
    }

    isEmpty() {
        return this.queue.length === 0
    }

    peak() {
        return this.isEmpty() ? undefined : this.queue[0]
    }

    length() {
        return this.queue.length
    }
}

export default Queue