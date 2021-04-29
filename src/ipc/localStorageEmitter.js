import LocalStorageEvent from "./localStorageEvent";

class LocalStorageEmitter {

    /**
     *
     * @type {Map<string, any>}
     */
    subscriptions;

    /**
     *
     * @type {Map<string, any>}
     */
    handles;

    /**
     *
     * @type {Map<string, any>}
     */
    invokes;

    constructor() {
        window.addEventListener('storage', ev => {
            let key = ev.key;
            if (!key.startsWith('$') || !key.endsWith('$')) {
                return;
            }
            let value;
            try {
                value = JSON.parse(ev.newValue);
            } catch (e) {
                value = null;
            }
            if (value === null) {
                console.log('localStorageEmitter ignore null', key)
                return;
            }
            this.subscriptions.forEach((subscription, k) => {
                if (k === key) {
                    subscription.listener(new LocalStorageEvent(this), value.args);
                    if (subscription.once) {
                        this.subscriptions.delete(k);
                    }
                }
            });

            this.handles.forEach((handle, k) => {
                let index = key.indexOf('$$');
                if (index === -1) {
                    return;
                }
                let invokeKey = key.substr(0, index + 1)
                if (k === invokeKey) {
                    let invokeId = value.invokeId;
                    let returnValue = handle.listener(new LocalStorageEvent(this), value.args);
                    let invokeReturnValueKey = k + '$' + invokeId + '$' + 'r' + '$';
                    if (returnValue instanceof Promise) {
                        returnValue.then(v => {
                            let r = {r: v}
                            localStorage.setItem(invokeReturnValueKey, JSON.stringify(r));
                        }).catch(reason => {
                            console.log('handle failed', reason)
                        });
                        if (handle.once) {
                            this.handles.delete(k)
                        }

                    } else {
                        let r = {r: returnValue}
                        console.log('handle res', returnValue)
                        localStorage.setItem(invokeReturnValueKey, JSON.stringify(r));
                        if (handle.once) {
                            this.handles.delete(k)
                        }
                    }
                    localStorage.removeItem(invokeKey)
                }
            });

            this.invokes.forEach((invoke, k) => {
                let invokeReturnValueKey = k + 'r' + '$';
                if (invokeReturnValueKey === key) {
                    invoke.callback(value.r);
                    this.invokes.delete(key)

                    localStorage.removeItem(invokeReturnValueKey)
                    localStorage.removeItem(k)
                }
            })

        })
        this.subscriptions = new Map();
        this.handles = new Map();
        this.invokes = new Map();
    }

    /**
     *
     * @param {string} channel
     * @param {function(LocalStorageEvent, args)} listener
     */
    on(channel, listener) {
        this.handles.set('$' + channel + '$', {once: false, listener: listener});
    }

    once(channel, listener) {
        this.handles.set('$' + channel + '$', {once: true, listener: listener});
    }

    send(channel, args) {
        let tmp = {args: args}
        localStorage.setItem('$' + channel + '$', JSON.stringify(tmp))
    }

    //
    // sendSync(channel, args) {
    //     this.send(channel, args);
    // }

    handle(channel, listener) {
        this.handles.set('$' + channel + '$', {once: false, listener: listener});
    }

    handleOnce(channel, listener) {
        this.handles.set('$' + channel + '$', {once: true, listener: listener});
    }

    invoke(channel, args, callback) {
        let invokeId = new Date().getTime() + '-' + Math.ceil(Math.random() * 10000);
        this.invokes.set('$' + channel + '$$' + invokeId + '$', {invokeId: invokeId, callback: callback});
        let tmp = {
            invokeId: invokeId,
            args: args
        }
        localStorage.setItem('$' + channel + '$$' + invokeId + '$', JSON.stringify(tmp))
    }

    promiseInvoke(channel, args) {
        return new Promise(((resolve, reject) => {
            this.invoke(channel, args, v => {
                resolve(v);
            });
        }))
    }

    _dump() {
        console.log('dump localStorageEmitter')
        this.subscriptions.forEach((value, key) => {
            console.log(key, value)
        })
        this.handles.forEach((value, key) => {
            console.log(key, value)
        })
        this.invokes.forEach((value, key) => {
            console.log(key, value)
        })
    }
}

let self = new LocalStorageEmitter();
export default self;
