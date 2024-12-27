export default class RCEvent {
    // 第1个字节，第一个字节高 4 位表示事件类型
    // 0b0000 mv
    // 0b0001 wl
    // 0b0010 md
    // 0b0011 mu
    // 0b0100 kd
    // 0b0101 ku
    // 0B0110 uac status
    static MV_MASK = 0b0000_0000
    static WL_MASK = 0b0001_0000
    static MD_MASK = 0b0010_0000
    static MU_MASK = 0b0011_0000
    static KD_MASK = 0b0100_0000
    static KU_MASK = 0b0101_0000
    static UAC_MASK= 0b0110_0000
    name = '';
    numberArgs = []
    strArgs = [];

    toArrayBuffer() {
        let array
        switch (this.name) {
            case 'mv':
                array = new Uint8Array(5);
                array[0] = RCEvent.MV_MASK;
                array[1] = (0xFF00 & this.numberArgs[0]) >> 8;
                array[2] = 0x00FF & this.numberArgs[0];
                array[3] = (0xFF00 & this.numberArgs[1]) >> 8;
                array[4] = 0x00FF & this.numberArgs[1];
                break
            case 'wl':
                array = new Uint8Array(5);
                array[0] = RCEvent.WL_MASK
                array[1] = (0xFF00 & this.numberArgs[0]) >> 8;
                array[2] = 0x00FF & this.numberArgs[0];
                array[3] = (0xFF00 & this.numberArgs[1]) >> 8;
                array[4] = 0x00FF & this.numberArgs[1];
                break
            case "md":
                array = new Uint8Array(5);
                array[0] = RCEvent.MD_MASK | (0x00FF & this.numberArgs[0]);
                array[1] = (0xFF00 & this.numberArgs[1]) >> 8;
                array[2] = 0x00FF & this.numberArgs[1];
                array[3] = (0xFF00 & this.numberArgs[2]) >> 8;
                array[4] = 0x00FF & this.numberArgs[2];
                break
            case "mu":
                array = new Uint8Array(5);
                array[0] = RCEvent.MU_MASK | (0x00FF & this.numberArgs[0]);
                array[1] = (0xFF00 & this.numberArgs[1]) >> 8;
                array[2] = 0x00FF & this.numberArgs[1];
                array[3] = (0xFF00 & this.numberArgs[2]) >> 8;
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
            case 'uac':
                array = new Uint8Array(2);
                array[0] = RCEvent.UAC_MASK;
                array[1] = 0x00FF & this.numberArgs[0];
                break
            default:
                break
        }
        return Buffer.from(array);
    }

    static fromArrayBuffer(arrayBuffer) {
        let rcEvent = new RCEvent()
        let array = new Uint8Array(arrayBuffer)
        let mask = array[0] & 0b1111_0000
        let str = ''
        switch (mask) {
            case this.MV_MASK:
                rcEvent.name = 'mv'
                rcEvent.numberArgs[0] = (array[1] << 8) + array[2]
                rcEvent.numberArgs[1] = (array[3] << 8) + array[4]
                break
            case this.WL_MASK:
                rcEvent.name = 'wl'
                // 有符号
                let uint8Arr = []
                uint8Arr[0] = (array[1] << 8) + array[2]
                uint8Arr[1] = (array[3] << 8) + array[4]
                let int8Arr = new Int8Array(uint8Arr)
                rcEvent.numberArgs = [...int8Arr]
                break
            case this.MD_MASK:
                rcEvent.name = 'md'
                rcEvent.numberArgs[0] = array[0] & 0b0000_1111
                rcEvent.numberArgs[1] = (array[1] << 8) + array[2]
                rcEvent.numberArgs[2] = (array[3] << 8) + array[4]
                break
            case this.MU_MASK:
                rcEvent.name = 'mu'
                rcEvent.numberArgs[0] = array[0] & 0b0000_1111
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
            case this.UAC_MASK:
                rcEvent.name = 'uac'
                rcEvent.numberArgs[0] = 0x00FF && array[1]
                break
            default:
                break
        }
        return rcEvent;
    }
}

// let rcEvent = new RCEvent()
// rcEvent.name = 'wl'
// rcEvent.numberArgs = [ -8, 4]
// // rcEvent.strArgs = ['kcy']
// let buffer = rcEvent.toArrayBuffer()
// let e = RCEvent.fromArrayBuffer(buffer)
// console.log('receive rcEvent', e);
