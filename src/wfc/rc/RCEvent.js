export default class RCEvent {
    static MV_MASK = 0b00000000
    static WL_MASK = 0b00100000
    static MD_MASK = 0b01000000
    static MU_MASK = 0b01100000
    static KD_MASK = 0b10000000
    static KU_MASK = 0b10100000
    name = '';
    numberArgs = []
    strArgs = [];

    toArrayBuffer() {
        // 第1个字节，第一个字节高 3 位表示事件类型
        // 0b000 mv
        // 0b001 wl
        // 0b010 md
        // 0b011 mu
        // 0b100 kd
        // 0b101 ku
        let array
        switch (this.name) {
            case 'mv':
                array = new Uint8Array(5);
                array[0] = RCEvent.MV_MASK;
                array[1] = 0xFF00 & this.numberArgs[0];
                array[2] = 0x00FF & this.numberArgs[0];
                array[3] = 0xFF00 & this.numberArgs[1];
                array[4] = 0x00FF & this.numberArgs[1];
                break
            case 'wl':
                array = new Uint8Array(5);
                array[0] = RCEvent.WL_MASK
                array[1] = 0xFF00 & this.numberArgs[0];
                array[2] = 0x00FF & this.numberArgs[0];
                array[3] = 0xFF00 & this.numberArgs[1];
                array[4] = 0x00FF & this.numberArgs[1];
                break
            case "md":
                array = new Uint8Array(5);
                array[0] = RCEvent.MD_MASK | (0x00FF & this.numberArgs[0]);
                array[1] = 0xFF00 & this.numberArgs[1];
                array[2] = 0x00FF & this.numberArgs[1];
                array[3] = 0xFF00 & this.numberArgs[2];
                array[4] = 0x00FF & this.numberArgs[2];
                break
            case "mu":
                array = new Uint8Array(5);
                array[0] = RCEvent.MU_MASK | (0x00FF & this.numberArgs[0]);
                array[1] = 0xFF00 & this.numberArgs[1];
                array[2] = 0x00FF & this.numberArgs[1];
                array[3] = 0xFF00 & this.numberArgs[2];
                array[4] = 0x00FF & this.numberArgs[2];
                break
            case "kd":
                let kdStr = this.strArgs.join(',');
                array = Uint8Array.of(RCEvent.KD_MASK, ...new TextEncoder().encode(kdStr));
                break
            case "ku":
                let kuStr = this.strArgs.join(',');
                array = Uint8Array.of(RCEvent.KU_MASK, ...new TextEncoder().encode(kuStr));
                break
            default:
                break
        }
        return Buffer.from(array);
    }

    static fromArrayBuffer(arrayBuffer) {
        let rcEvent = new RCEvent()
        let array = new Uint8Array(arrayBuffer)
        let mask = array[0] & 0b11100000
        let str = ''
        switch (mask) {
            case this.MV_MASK:
                rcEvent.name = 'mv'
                rcEvent.numberArgs[0] = (array[1] << 8) + array[2]
                rcEvent.numberArgs[1] = (array[3] << 8) + array[4]
                break
            case this.WL_MASK:
                rcEvent.name = 'wl'
                rcEvent.numberArgs[0] = (array[1] << 8) + array[2]
                rcEvent.numberArgs[1] = (array[3] << 8) + array[4]
                break
            case this.MD_MASK:
                rcEvent.name = 'md'
                rcEvent.numberArgs[0] = array[0] & 0b00011111
                rcEvent.numberArgs[1] = (array[1] << 8) + array[2]
                rcEvent.numberArgs[2] = (array[3] << 8) + array[4]
                break
            case this.MU_MASK:
                rcEvent.name = 'mu'
                rcEvent.numberArgs[0] = array[0] & 0b00011111
                rcEvent.numberArgs[1] = (array[1] << 8) + array[2]
                rcEvent.numberArgs[2] = (array[3] << 8) + array[4]
                break
            case this.KD_MASK:
                rcEvent.name = 'kd'
                str = new TextDecoder().decode(array.slice(1))
                rcEvent.strArgs = str.split(',')
                break
            case this.KU_MASK:
                rcEvent.name = 'ku'
                str = new TextDecoder().decode(array.slice(1))
                rcEvent.strArgs = str.split(',')
                break
            default:
                break
        }
        return rcEvent;
    }
}

// let rcEvent = new RcEvent()
// rcEvent.name = 'ku'
// //rcEvent.numberArgs = [111, 222]
// rcEvent.strArgs = ['kcy']
// let buffer = rcEvent.toArrayBuffer()
// console.log(RcEvent.fromArrayBuffer(buffer))
