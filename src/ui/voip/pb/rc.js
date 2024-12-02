/*eslint-disable block-scoped-var, id-length, no-control-regex, no-magic-numbers, no-prototype-builtins, no-redeclare, no-shadow, no-var, sort-vars*/
"use strict";

var $protobuf = require("./protobuf.min");

// Common aliases
var $Reader = $protobuf.Reader, $Writer = $protobuf.Writer, $util = $protobuf.util;

// Exported root namespace
var $root = $protobuf.roots["default"] || ($protobuf.roots["default"] = {});

$root.RCEvent = (function() {

    /**
     * Properties of a RCEvent.
     * @exports IRCEvent
     * @interface IRCEvent
     * @property {string} name RCEvent name
     * @property {Array.<number>|null} [numberArgs] RCEvent numberArgs
     * @property {Array.<number>|null} [strArgs] RCEvent strArgs
     */

    /**
     * Constructs a new RCEvent.
     * @exports RCEvent
     * @classdesc Represents a RCEvent.
     * @implements IRCEvent
     * @constructor
     * @param {IRCEvent=} [properties] Properties to set
     */
    function RCEvent(properties) {
        this.numberArgs = [];
        this.strArgs = [];
        if (properties)
            for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                    this[keys[i]] = properties[keys[i]];
    }

    /**
     * RCEvent name.
     * @member {string} name
     * @memberof RCEvent
     * @instance
     */
    RCEvent.prototype.name = "";

    /**
     * RCEvent numberArgs.
     * @member {Array.<number>} numberArgs
     * @memberof RCEvent
     * @instance
     */
    RCEvent.prototype.numberArgs = $util.emptyArray;

    /**
     * RCEvent strArgs.
     * @member {Array.<number>} strArgs
     * @memberof RCEvent
     * @instance
     */
    RCEvent.prototype.strArgs = $util.emptyArray;

    /**
     * Creates a new RCEvent instance using the specified properties.
     * @function create
     * @memberof RCEvent
     * @static
     * @param {IRCEvent=} [properties] Properties to set
     * @returns {RCEvent} RCEvent instance
     */
    RCEvent.create = function create(properties) {
        return new RCEvent(properties);
    };

    /**
     * Encodes the specified RCEvent message. Does not implicitly {@link RCEvent.verify|verify} messages.
     * @function encode
     * @memberof RCEvent
     * @static
     * @param {IRCEvent} message RCEvent message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    RCEvent.encode = function encode(message, writer) {
        if (!writer)
            writer = $Writer.create();
        writer.uint32(/* id 2, wireType 2 =*/18).string(message.name);
        if (message.numberArgs != null && message.numberArgs.length)
            for (var i = 0; i < message.numberArgs.length; ++i)
                writer.uint32(/* id 3, wireType 0 =*/24).int32(message.numberArgs[i]);
        if (message.strArgs != null && message.strArgs.length)
            for (var i = 0; i < message.strArgs.length; ++i)
                writer.uint32(/* id 4, wireType 0 =*/32).int32(message.strArgs[i]);
        return writer;
    };

    /**
     * Encodes the specified RCEvent message, length delimited. Does not implicitly {@link RCEvent.verify|verify} messages.
     * @function encodeDelimited
     * @memberof RCEvent
     * @static
     * @param {IRCEvent} message RCEvent message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    RCEvent.encodeDelimited = function encodeDelimited(message, writer) {
        return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a RCEvent message from the specified reader or buffer.
     * @function decode
     * @memberof RCEvent
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {RCEvent} RCEvent
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    RCEvent.decode = function decode(reader, length) {
        if (!(reader instanceof $Reader))
            reader = $Reader.create(reader);
        var end = length === undefined ? reader.len : reader.pos + length, message = new $root.RCEvent();
        while (reader.pos < end) {
            var tag = reader.uint32();
            switch (tag >>> 3) {
                case 2:
                    message.name = reader.string();
                    break;
                case 3:
                    if (!(message.numberArgs && message.numberArgs.length))
                        message.numberArgs = [];
                    if ((tag & 7) === 2) {
                        var end2 = reader.uint32() + reader.pos;
                        while (reader.pos < end2)
                            message.numberArgs.push(reader.int32());
                    } else
                        message.numberArgs.push(reader.int32());
                    break;
                case 4:
                    if (!(message.strArgs && message.strArgs.length))
                        message.strArgs = [];
                    if ((tag & 7) === 2) {
                        var end2 = reader.uint32() + reader.pos;
                        while (reader.pos < end2)
                            message.strArgs.push(reader.int32());
                    } else
                        message.strArgs.push(reader.int32());
                    break;
                default:
                    reader.skipType(tag & 7);
                    break;
            }
        }
        if (!message.hasOwnProperty("name"))
            throw $util.ProtocolError("missing required 'name'", { instance: message });
        return message;
    };

    /**
     * Decodes a RCEvent message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof RCEvent
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {RCEvent} RCEvent
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    RCEvent.decodeDelimited = function decodeDelimited(reader) {
        if (!(reader instanceof $Reader))
            reader = new $Reader(reader);
        return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a RCEvent message.
     * @function verify
     * @memberof RCEvent
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    RCEvent.verify = function verify(message) {
        if (typeof message !== "object" || message === null)
            return "object expected";
        if (!$util.isString(message.name))
            return "name: string expected";
        if (message.numberArgs != null && message.hasOwnProperty("numberArgs")) {
            if (!Array.isArray(message.numberArgs))
                return "numberArgs: array expected";
            for (var i = 0; i < message.numberArgs.length; ++i)
                if (!$util.isInteger(message.numberArgs[i]))
                    return "numberArgs: integer[] expected";
        }
        if (message.strArgs != null && message.hasOwnProperty("strArgs")) {
            if (!Array.isArray(message.strArgs))
                return "strArgs: array expected";
            for (var i = 0; i < message.strArgs.length; ++i)
                if (!$util.isInteger(message.strArgs[i]))
                    return "strArgs: integer[] expected";
        }
        return null;
    };

    /**
     * Creates a RCEvent message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof RCEvent
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {RCEvent} RCEvent
     */
    RCEvent.fromObject = function fromObject(object) {
        if (object instanceof $root.RCEvent)
            return object;
        var message = new $root.RCEvent();
        if (object.name != null)
            message.name = String(object.name);
        if (object.numberArgs) {
            if (!Array.isArray(object.numberArgs))
                throw TypeError(".RCEvent.numberArgs: array expected");
            message.numberArgs = [];
            for (var i = 0; i < object.numberArgs.length; ++i)
                message.numberArgs[i] = object.numberArgs[i] | 0;
        }
        if (object.strArgs) {
            if (!Array.isArray(object.strArgs))
                throw TypeError(".RCEvent.strArgs: array expected");
            message.strArgs = [];
            for (var i = 0; i < object.strArgs.length; ++i)
                message.strArgs[i] = object.strArgs[i] | 0;
        }
        return message;
    };

    /**
     * Creates a plain object from a RCEvent message. Also converts values to other types if specified.
     * @function toObject
     * @memberof RCEvent
     * @static
     * @param {RCEvent} message RCEvent
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    RCEvent.toObject = function toObject(message, options) {
        if (!options)
            options = {};
        var object = {};
        if (options.arrays || options.defaults) {
            object.numberArgs = [];
            object.strArgs = [];
        }
        if (options.defaults)
            object.name = "";
        if (message.name != null && message.hasOwnProperty("name"))
            object.name = message.name;
        if (message.numberArgs && message.numberArgs.length) {
            object.numberArgs = [];
            for (var j = 0; j < message.numberArgs.length; ++j)
                object.numberArgs[j] = message.numberArgs[j];
        }
        if (message.strArgs && message.strArgs.length) {
            object.strArgs = [];
            for (var j = 0; j < message.strArgs.length; ++j)
                object.strArgs[j] = message.strArgs[j];
        }
        return object;
    };

    /**
     * Converts this RCEvent to JSON.
     * @function toJSON
     * @memberof RCEvent
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    RCEvent.prototype.toJSON = function toJSON() {
        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    return RCEvent;
})();

module.exports = $root;
