/*eslint-disable block-scoped-var, id-length, no-control-regex, no-magic-numbers, no-prototype-builtins, no-redeclare, no-shadow, no-var, sort-vars*/
"use strict";

var $protobuf = require("./protobuf.min");

// Common aliases
var $Reader = $protobuf.Reader, $Writer = $protobuf.Writer, $util = $protobuf.util;

// Exported root namespace
var $root = $protobuf.roots["default"] || ($protobuf.roots["default"] = {});

$root.RCEventArgs = (function() {

    /**
     * Properties of a RCEventArgs.
     * @exports IRCEventArgs
     * @interface IRCEventArgs
     * @property {string} eventName RCEventArgs eventName
     * @property {Array.<number>|null} [values] RCEventArgs values
     */

    /**
     * Constructs a new RCEventArgs.
     * @exports RCEventArgs
     * @classdesc Represents a RCEventArgs.
     * @implements IRCEventArgs
     * @constructor
     * @param {IRCEventArgs=} [properties] Properties to set
     */
    function RCEventArgs(properties) {
        this.values = [];
        if (properties)
            for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                    this[keys[i]] = properties[keys[i]];
    }

    /**
     * RCEventArgs eventName.
     * @member {string} eventName
     * @memberof RCEventArgs
     * @instance
     */
    RCEventArgs.prototype.eventName = "";

    /**
     * RCEventArgs values.
     * @member {Array.<number>} values
     * @memberof RCEventArgs
     * @instance
     */
    RCEventArgs.prototype.values = $util.emptyArray;

    /**
     * Creates a new RCEventArgs instance using the specified properties.
     * @function create
     * @memberof RCEventArgs
     * @static
     * @param {IRCEventArgs=} [properties] Properties to set
     * @returns {RCEventArgs} RCEventArgs instance
     */
    RCEventArgs.create = function create(properties) {
        return new RCEventArgs(properties);
    };

    /**
     * Encodes the specified RCEventArgs message. Does not implicitly {@link RCEventArgs.verify|verify} messages.
     * @function encode
     * @memberof RCEventArgs
     * @static
     * @param {IRCEventArgs} message RCEventArgs message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    RCEventArgs.encode = function encode(message, writer) {
        if (!writer)
            writer = $Writer.create();
        writer.uint32(/* id 1, wireType 2 =*/10).string(message.eventName);
        if (message.values != null && message.values.length)
            for (var i = 0; i < message.values.length; ++i)
                writer.uint32(/* id 2, wireType 0 =*/16).int32(message.values[i]);
        return writer;
    };

    /**
     * Encodes the specified RCEventArgs message, length delimited. Does not implicitly {@link RCEventArgs.verify|verify} messages.
     * @function encodeDelimited
     * @memberof RCEventArgs
     * @static
     * @param {IRCEventArgs} message RCEventArgs message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    RCEventArgs.encodeDelimited = function encodeDelimited(message, writer) {
        return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a RCEventArgs message from the specified reader or buffer.
     * @function decode
     * @memberof RCEventArgs
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {RCEventArgs} RCEventArgs
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    RCEventArgs.decode = function decode(reader, length) {
        if (!(reader instanceof $Reader))
            reader = $Reader.create(reader);
        var end = length === undefined ? reader.len : reader.pos + length, message = new $root.RCEventArgs();
        while (reader.pos < end) {
            var tag = reader.uint32();
            switch (tag >>> 3) {
                case 1:
                    message.eventName = reader.string();
                    break;
                case 2:
                    if (!(message.values && message.values.length))
                        message.values = [];
                    if ((tag & 7) === 2) {
                        var end2 = reader.uint32() + reader.pos;
                        while (reader.pos < end2)
                            message.values.push(reader.int32());
                    } else
                        message.values.push(reader.int32());
                    break;
                default:
                    reader.skipType(tag & 7);
                    break;
            }
        }
        if (!message.hasOwnProperty("eventName"))
            throw $util.ProtocolError("missing required 'eventName'", { instance: message });
        return message;
    };

    /**
     * Decodes a RCEventArgs message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof RCEventArgs
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {RCEventArgs} RCEventArgs
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    RCEventArgs.decodeDelimited = function decodeDelimited(reader) {
        if (!(reader instanceof $Reader))
            reader = new $Reader(reader);
        return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a RCEventArgs message.
     * @function verify
     * @memberof RCEventArgs
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    RCEventArgs.verify = function verify(message) {
        if (typeof message !== "object" || message === null)
            return "object expected";
        if (!$util.isString(message.eventName))
            return "eventName: string expected";
        if (message.values != null && message.hasOwnProperty("values")) {
            if (!Array.isArray(message.values))
                return "values: array expected";
            for (var i = 0; i < message.values.length; ++i)
                if (!$util.isInteger(message.values[i]))
                    return "values: integer[] expected";
        }
        return null;
    };

    /**
     * Creates a RCEventArgs message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof RCEventArgs
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {RCEventArgs} RCEventArgs
     */
    RCEventArgs.fromObject = function fromObject(object) {
        if (object instanceof $root.RCEventArgs)
            return object;
        var message = new $root.RCEventArgs();
        if (object.eventName != null)
            message.eventName = String(object.eventName);
        if (object.values) {
            if (!Array.isArray(object.values))
                throw TypeError(".RCEventArgs.values: array expected");
            message.values = [];
            for (var i = 0; i < object.values.length; ++i)
                message.values[i] = object.values[i] | 0;
        }
        return message;
    };

    /**
     * Creates a plain object from a RCEventArgs message. Also converts values to other types if specified.
     * @function toObject
     * @memberof RCEventArgs
     * @static
     * @param {RCEventArgs} message RCEventArgs
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    RCEventArgs.toObject = function toObject(message, options) {
        if (!options)
            options = {};
        var object = {};
        if (options.arrays || options.defaults)
            object.values = [];
        if (options.defaults)
            object.eventName = "";
        if (message.eventName != null && message.hasOwnProperty("eventName"))
            object.eventName = message.eventName;
        if (message.values && message.values.length) {
            object.values = [];
            for (var j = 0; j < message.values.length; ++j)
                object.values[j] = message.values[j];
        }
        return object;
    };

    /**
     * Converts this RCEventArgs to JSON.
     * @function toJSON
     * @memberof RCEventArgs
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    RCEventArgs.prototype.toJSON = function toJSON() {
        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    return RCEventArgs;
})();

$root.RCEvent = (function() {

    /**
     * Properties of a RCEvent.
     * @exports IRCEvent
     * @interface IRCEvent
     * @property {string} eventCategory RCEvent eventCategory
     * @property {IRCEventArgs} args RCEvent args
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
        if (properties)
            for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                    this[keys[i]] = properties[keys[i]];
    }

    /**
     * RCEvent eventCategory.
     * @member {string} eventCategory
     * @memberof RCEvent
     * @instance
     */
    RCEvent.prototype.eventCategory = "";

    /**
     * RCEvent args.
     * @member {IRCEventArgs} args
     * @memberof RCEvent
     * @instance
     */
    RCEvent.prototype.args = null;

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
        writer.uint32(/* id 1, wireType 2 =*/10).string(message.eventCategory);
        $root.RCEventArgs.encode(message.args, writer.uint32(/* id 2, wireType 2 =*/18).fork()).ldelim();
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
                case 1:
                    message.eventCategory = reader.string();
                    break;
                case 2:
                    message.args = $root.RCEventArgs.decode(reader, reader.uint32());
                    break;
                default:
                    reader.skipType(tag & 7);
                    break;
            }
        }
        if (!message.hasOwnProperty("eventCategory"))
            throw $util.ProtocolError("missing required 'eventCategory'", { instance: message });
        if (!message.hasOwnProperty("args"))
            throw $util.ProtocolError("missing required 'args'", { instance: message });
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
        if (!$util.isString(message.eventCategory))
            return "eventCategory: string expected";
        {
            var error = $root.RCEventArgs.verify(message.args);
            if (error)
                return "args." + error;
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
        if (object.eventCategory != null)
            message.eventCategory = String(object.eventCategory);
        if (object.args != null) {
            if (typeof object.args !== "object")
                throw TypeError(".RCEvent.args: object expected");
            message.args = $root.RCEventArgs.fromObject(object.args);
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
        if (options.defaults) {
            object.eventCategory = "";
            object.args = null;
        }
        if (message.eventCategory != null && message.hasOwnProperty("eventCategory"))
            object.eventCategory = message.eventCategory;
        if (message.args != null && message.hasOwnProperty("args"))
            object.args = $root.RCEventArgs.toObject(message.args, options);
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
