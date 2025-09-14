export class EventEmitter {
    constructor() {
        this.events = {};
    }

    on(eventName, listener) {
        if (!this.events[eventName]) {
            this.events[eventName] = [];
        }
        this.events[eventName].push(listener);
        return this;
    }

    once(eventName, listener) {
        const onceWrapper = (...args) => {
            listener.apply(this, args);
            this.off(eventName, onceWrapper);
        };
        this.on(eventName, onceWrapper);
        return this;
    }

    off(eventName, listenerToRemove) {
        if (!this.events[eventName]) {
            return this;
        }

        this.events[eventName] = this.events[eventName].filter(
            listener => listener !== listenerToRemove
        );

        return this;
    }

    emit(eventName, ...args) {
        if (!this.events[eventName]) {
            return false;
        }

        this.events[eventName].forEach(listener => {
            try {
                listener.apply(this, args);
            } catch (error) {
                console.error(`Error in event listener for '${eventName}':`, error);
            }
        });

        return true;
    }

    removeAllListeners(eventName) {
        if (eventName) {
            delete this.events[eventName];
        } else {
            this.events = {};
        }
        return this;
    }

    listeners(eventName) {
        return this.events[eventName] || [];
    }

    listenerCount(eventName) {
        return this.listeners(eventName).length;
    }

    eventNames() {
        return Object.keys(this.events);
    }
}