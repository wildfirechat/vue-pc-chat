/**
 * Renderer-side DSH public state. Never stores robotSecret / AI key.
 */
export const dshState = {
    provision: null,
    hostStatus: null,
};

export function setDshProvision(provision) {
    dshState.provision = provision || null;
}

export function setDshHostStatus(status) {
    dshState.hostStatus = status || null;
}

export function localRobotId() {
    return dshState.provision && dshState.provision.robot
        ? dshState.provision.robot.robotId || ''
        : '';
}
