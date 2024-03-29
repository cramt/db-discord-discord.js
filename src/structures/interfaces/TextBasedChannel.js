const path = require('path');
const Message = require('../Message');
const MessageCollector = require('../MessageCollector');
const Collection = require('../../util/Collection');
const Attachment = require('../../structures/Attachment');
const RichEmbed = require('../../structures/RichEmbed');
const Snowflake = require('../../util/Snowflake');
const util = require('util');

/**
 * Interface for classes that have text-channel-like features.
 * @interface
 */
class TextBasedChannel {
    constructor() {
        /**
         * A collection containing the messages sent to this channel
         * @type {Collection<Snowflake, Message>}
         */
        this.messages = new Collection();

        /**
         * The ID of the last message in the channel, if one was sent
         * @type {?Snowflake}
         */
        this.lastMessageID = null;

        /**
         * The Message object of the last message in the channel, if one was sent
         * @type {?Message}
         */
        this.lastMessage = null;

        /**
         * The timestamp when the last pinned message was pinned, if there was one
         * @type {?number}
         */
        this.lastPinTimestamp = null;
    }

    /**
     * Options provided when sending or editing a message.
     * @typedef {Object} MessageOptions
     * @property {boolean} [tts=false] Whether or not the message should be spoken aloud
     * @property {string} [nonce=''] The nonce for the message
     * @property {RichEmbed|Object} [embed] An embed for the message
     * (see [here](https://discordapp.com/developers/docs/resources/channel#embed-object) for more details)
     * @property {boolean} [disableEveryone=this.client.options.disableEveryone] Whether or not @everyone and @here
     * should be replaced with plain-text
     * @property {FileOptions|BufferResolvable|Attachment} [file] A file to send with the message **(deprecated)**
     * @property {FileOptions[]|BufferResolvable[]|Attachment[]} [files] Files to send with the message
     * @property {string|boolean} [code] Language for optional codeblock formatting to apply
     * @property {boolean|SplitOptions} [split=false] Whether or not the message should be split into multiple messages if
     * it exceeds the character limit. If an object is provided, these are the options for splitting the message
     * @property {UserResolvable} [reply] User to reply to (prefixes the message with a mention, except in DMs)
     */

    /**
     * @typedef {Object} FileOptions
     * @property {BufferResolvable} attachment File to attach
     * @property {string} [name='file.jpg'] Filename of the attachment
     */

    /**
     * Options for splitting a message.
     * @typedef {Object} SplitOptions
     * @property {number} [maxLength=1950] Maximum character length per message piece
     * @property {string} [char='\n'] Character to split the message with
     * @property {string} [prepend=''] Text to prepend to every piece except the first
     * @property {string} [append=''] Text to append to every piece except the last
     */

    /**
     * Send a message to this channel.
     * @param {StringResolvable} [content] Text for the message
     * @param {MessageOptions|Attachment|RichEmbed} [options] Options for the message,
     * can also be just a RichEmbed or Attachment
     * @returns {Promise<Message|Message[]>}
     * @example
     * // Send a basic message
     * channel.send('hello!')
     *   .then(message => console.log(`Sent message: ${message.content}`))
     *   .catch(console.error);
     * @example
     * // Send a remote file
     * channel.send({
     *   files: ['https://cdn.discordapp.com/icons/222078108977594368/6e1019b3179d71046e463a75915e7244.png?size=2048']
     * })
     *   .then(console.log)
     *   .catch(console.error);
     * @example
     * // Send a local file
     * channel.send({
     *   files: [{
     *     attachment: 'entire/path/to/file.jpg',
     *     name: 'file.jpg'
     *   }]
     * })
     *   .then(console.log)
     *   .catch(console.error);
     * @example
     * // Send an embed with a local image inside
     * channel.send('This is an embed', {
     *   embed: {
     *     thumbnail: {
     *          url: 'attachment://file.jpg'
     *       }
     *    },
     *    files: [{
     *       attachment: 'entire/path/to/file.jpg',
     *       name: 'file.jpg'
     *    }]
     * })
     *   .then(console.log)
     *   .catch(console.error);
     */
    // eslint-disable-next-line complexity
    send(content, options) {
        if (!options && typeof content === 'object' && !(content instanceof Array)) {
            options = content;
            content = '';
        } else if (!options) {
            options = {};
        }

        const { reply } = options;
        if (options instanceof Attachment) options = { files: [options.file] };
        if (options instanceof RichEmbed) {
            if (options.reply) options.reply = undefined;
            options = { embed: options };
        }
        options.reply = reply;

        if (options.embed) {
            if (options.embed.file) {
                if (options.files) options.files.push(options.embed.file);
                else options.files = [options.embed.file];
            }
            if (options.embed.files) {
                if (options.files) options.files = options.files.concat(options.embed.files);
                else options.files = options.embed.files;
            }
        }

        if (options.file) {
            if (options.files) options.files.push(options.file);
            else options.files = [options.file];
        }

        if (options.embed) options.embed = new RichEmbed(options.embed)._apiTransform();

        if (options.files) {
            for (let i = 0; i < options.files.length; i++) {
                let file = options.files[i];
                if (!file || typeof file === 'string' || Buffer.isBuffer(file)) file = { attachment: file };
                if (!file.name) {
                    if (typeof file.attachment === 'string') {
                        file.name = path.basename(file.attachment);
                    } else if (file.attachment && file.attachment.path) {
                        file.name = path.basename(file.attachment.path);
                    } else if (file instanceof Attachment) {
                        file = { attachment: file.file, name: path.basename(file.file) || 'file.jpg' };
                    } else {
                        file.name = 'file.jpg';
                    }
                } else if (file instanceof Attachment) {
                    file = file.file;
                }
                options.files[i] = file;
            }

            return Promise.all(options.files.map(file =>
                this.client.resolver.resolveFile(file.attachment).then(resource => {
                    file.file = resource;
                    return file;
                })
            )).then(files => this.client.rest.methods.sendMessage(this, content, options, files));
        }

        return this.client.rest.methods.sendMessage(this, content, options);
    }

    /**
     * Gets a single message from this channel, regardless of it being cached or not.
     * @param {Snowflake} messageID ID of the message to get
     * @returns {Promise<Message>}
     * @example
     * // Get message
     * channel.fetchMessage('99539446449315840')
     *   .then(message => console.log(message.content))
     *   .catch(console.error);
     */
    fetchMessage(messageID) {
        if (!this.client.user.bot) {
            return this.fetchMessages({ limit: 1, around: messageID }).then(messages => {
                const msg = messages.get(messageID);
                if (!msg) throw new Error('Message not found.');
                return msg;
            });
        }
        return this.client.rest.methods.getChannelMessage(this, messageID).then(data => {
            const msg = data instanceof Message ? data : new Message(this, data, this.client);
            this._cacheMessage(msg);
            return msg;
        });
    }

    /**
     * The parameters to pass in when requesting previous messages from a channel. `around`, `before` and
     * `after` are mutually exclusive. All the parameters are optional.
     * @typedef {Object} ChannelLogsQueryOptions
     * @property {number} [limit=50] Number of messages to acquire
     * @property {Snowflake} [before] ID of a message to get the messages that were posted before it
     * @property {Snowflake} [after] ID of a message to get the messages that were posted after it
     * @property {Snowflake} [around] ID of a message to get the messages that were posted around it
     */

    /**
     * Gets the past messages sent in this channel. Resolves with a collection mapping message ID's to Message objects.
     * <info>The returned Collection does not contain reaction users of the messages if they were not cached.
     * Those need to be fetched separately in such a case.</info>
     * @param {ChannelLogsQueryOptions} [options={}] Query parameters to pass in
     * @returns {Promise<Collection<Snowflake, Message>>}
     * @example
     * // Get messages
     * channel.fetchMessages({ limit: 10 })
     *   .then(messages => console.log(`Received ${messages.size} messages`))
     *   .catch(console.error);
     * @example
     * // Get messages and filter by user ID
     * channel.fetchMessages()
     *   .then(messages => console.log(`${messages.filter(m => m.author.id === '84484653687267328').size} messages`))
     *   .catch(console.error);
     */
    fetchMessages(options = {}) {
        return this.client.rest.methods.getChannelMessages(this, options).then(data => {
            const messages = new Collection();
            for (const message of data) {
                const msg = new Message(this, message, this.client);
                messages.set(message.id, msg);
                this._cacheMessage(msg);
            }
            return messages;
        });
    }

    /**
     * Fetches the pinned messages of this channel and returns a collection of them.
     * <info>The returned Collection does not contain any reaction data of the messages.
     * Those need to be fetched separately.</info>
     * @returns {Promise<Collection<Snowflake, Message>>}
     * @example
     * // Get pinned messages
     * channel.fetchPinnedMessages()
     *   .then(messages => console.log(`Received ${messages.size} messages`))
     *   .catch(console.error);
     */
    fetchPinnedMessages() {
        return this.client.rest.methods.getChannelPinnedMessages(this).then(data => {
            const messages = new Collection();
            for (const message of data) {
                const msg = new Message(this, message, this.client);
                messages.set(message.id, msg);
                this._cacheMessage(msg);
            }
            return messages;
        });
    }

    /**
     * @typedef {Object} MessageSearchOptions
     * @property {string} [content] Message content
     * @property {Snowflake} [maxID] Maximum ID for the filter
     * @property {Snowflake} [minID] Minimum ID for the filter
     * @property {string} [has] One of `link`, `embed`, `file`, `video`, `image`, or `sound`,
     * or add `-` to negate (e.g. `-file`)
     * @property {ChannelResolvable} [channel] Channel to limit search to (only for guild search endpoint)
     * @property {UserResolvable} [author] Author to limit search
     * @property {string} [authorType] One of `user`, `bot`, `webhook`, or add `-` to negate (e.g. `-webhook`)
     * @property {string} [sortBy='recent'] `recent` or `relevant`
     * @property {string} [sortOrder='desc'] `asc` or `desc`
     * @property {number} [contextSize=2] How many messages to get around the matched message (0 to 2)
     * @property {number} [limit=25] Maximum number of results to get (1 to 25)
     * @property {number} [offset=0] Offset the "pages" of results (since you can only see 25 at a time)
     * @property {UserResolvable} [mentions] Mentioned user filter
     * @property {boolean} [mentionsEveryone] If everyone is mentioned
     * @property {string} [linkHostname] Filter links by hostname
     * @property {string} [embedProvider] The name of an embed provider
     * @property {string} [embedType] one of `image`, `video`, `url`, `rich`
     * @property {string} [attachmentFilename] The name of an attachment
     * @property {string} [attachmentExtension] The extension of an attachment
     * @property {Date} [before] Date to find messages before
     * @property {Date} [after] Date to find messages before
     * @property {Date} [during] Date to find messages during (range of date to date + 24 hours)
     * @property {boolean} [nsfw=false] Include results from NSFW channels
     */

    /**
     * @typedef {Object} MessageSearchResult
     * @property {number} totalResults Total result count
     * @property {Message[][]} messages Array of message results
     * The message which has triggered the result will have the `hit` property set to `true`
     */

    /**
     * Performs a search within the channel.
     * <warn>This is only available when using a user account.</warn>
     * @param {MessageSearchOptions} [options={}] Options to pass to the search
     * @returns {Promise<MessageSearchResult>}
     
     * @example
     * channel.search({
     *   content: 'discord.js',
     *   before: '2016-11-17'
     * }).then(res => {
     *   const hit = res.messages[0].find(m => m.hit).content;
     *   console.log(`I found: **${hit}**, total results: ${res.totalResults}`);
     * }).catch(console.error);
     */
    search(options = {}) {
        return this.client.rest.methods.search(this, options);
    }

    /**
     * Starts a typing indicator in the channel.
     * @param {number} [count] The number of times startTyping should be considered to have been called
     * @example
     * // Start typing in a channel
     * channel.startTyping();
     */
    startTyping(count) {
        if (typeof count !== 'undefined' && count < 1) throw new RangeError('Count must be at least 1.');
        if (this.client.user._typing.has(this.id)) {
            const entry = this.client.user._typing.get(this.id);
            entry.count = count || entry.count + 1;
            return;
        }

        const entry = {
            count: count || 1,
            interval: this.client.setInterval(() => {
                this.client.rest.methods.sendTyping(this.id).catch(() => {
                    this.client.clearInterval(entry.interval);
                    this.client.user._typing.delete(this.id);
                });
            }, 9000),
        };
        this.client.rest.methods.sendTyping(this.id).catch(() => {
            this.client.clearInterval(entry.interval);
            this.client.user._typing.delete(this.id);
        });
        this.client.user._typing.set(this.id, entry);
    }

    /**
     * Stops the typing indicator in the channel.
     * The indicator will only stop if this is called as many times as startTyping().
     * <info>It can take a few seconds for the client user to stop typing.</info>
     * @param {boolean} [force=false] Whether or not to reset the call count and force the indicator to stop
     * @example
     * // Reduce the typing count by one and stop typing if it reached 0
     * channel.stopTyping();
     * @example
     * // Force typing to fully stop in a channel
     * channel.stopTyping(true);
     */
    stopTyping(force = false) {
        if (this.client.user._typing.has(this.id)) {
            const entry = this.client.user._typing.get(this.id);
            entry.count--;
            if (entry.count <= 0 || force) {
                this.client.clearInterval(entry.interval);
                this.client.user._typing.delete(this.id);
            }
        }
    }

    /**
     * Whether or not the typing indicator is being shown in the channel
     * @type {boolean}
     * @readonly
     */
    get typing() {
        return this.client.user._typing.has(this.id);
    }

    /**
     * Number of times `startTyping` has been called
     * @type {number}
     * @readonly
     */
    get typingCount() {
        if (this.client.user._typing.has(this.id)) return this.client.user._typing.get(this.id).count;
        return 0;
    }

    /**
     * The Message object of the last message in the channel, if one was sent
     * @type {?Message}
     * @readonly
     */
    get lastMessage() {
        return this.messages.get(this.lastMessageID) || null;
    }

    /**
     * The date when the last pinned message was pinned, if there was one
     * @type {?Date}
     * @readonly
     */
    get lastPinAt() {
        return this.lastPinTimestamp ? new Date(this.lastPinTimestamp) : null;
    }

    /**
     * Creates a Message Collector
     * @param {CollectorFilter} filter The filter to create the collector with
     * @param {MessageCollectorOptions} [options={}] The options to pass to the collector
     * @returns {MessageCollector}
     
     */
    createCollector(filter, options) {
        return this.createMessageCollector(filter, options);
    }

    /**
     * Creates a Message Collector.
     * @param {CollectorFilter} filter The filter to create the collector with
     * @param {MessageCollectorOptions} [options={}] The options to pass to the collector
     * @returns {MessageCollector}
     * @example
     * // Create a message collector
     * const filter = m => m.content.includes('discord');
     * const collector = channel.createMessageCollector(filter, { time: 15000 });
     * collector.on('collect', m => console.log(`Collected ${m.content}`));
     * collector.on('end', collected => console.log(`Collected ${collected.size} items`));
     */
    createMessageCollector(filter, options = {}) {
        return new MessageCollector(this, filter, options);
    }

    /**
     * An object containing the same properties as CollectorOptions, but a few more:
     * @typedef {MessageCollectorOptions} AwaitMessagesOptions
     * @property {string[]} [errors] Stop/end reasons that cause the promise to reject
     */

    /**
     * Similar to createCollector but in promise form. Resolves with a collection of messages that pass the specified
     * filter.
     * @param {CollectorFilter} filter The filter function to use
     * @param {AwaitMessagesOptions} [options={}] Optional options to pass to the internal collector
     * @returns {Promise<Collection<Snowflake, Message>>}
     * @example
     * // Await !vote messages
     * const filter = m => m.content.startsWith('!vote');
     * // Errors: ['time'] treats ending because of the time limit as an error
     * channel.awaitMessages(filter, { max: 4, time: 60000, errors: ['time'] })
     *   .then(collected => console.log(collected.size))
     *   .catch(collected => console.log(`After a minute, only ${collected.size} out of 4 voted.`));
     */
    awaitMessages(filter, options = {}) {
        return new Promise((resolve, reject) => {
            const collector = this.createCollector(filter, options);
            collector.once('end', (collection, reason) => {
                if (options.errors && options.errors.includes(reason)) {
                    reject(collection);
                } else {
                    resolve(collection);
                }
            });
        });
    }

    /**
     * Bulk delete given messages that are newer than two weeks.
     * <warn>This is only available when using a bot account.</warn>
     * @param {Collection<Snowflake, Message>|Message[]|Snowflake[]|number} messages
     * Messages or number of messages to delete
     * @param {boolean} [filterOld=false] Filter messages to remove those which are older than two weeks automatically
     * @returns {Promise<Collection<Snowflake, Message>>} Deleted messages
     * @example
     * // Bulk delete messages
     * channel.bulkDelete(5)
     *   .then(messages => console.log(`Bulk deleted ${messages.size} messages`))
     *   .catch(console.error);
     */
    bulkDelete(messages, filterOld = false) {
        if (messages instanceof Array || messages instanceof Collection) {
            let messageIDs = messages instanceof Collection ? messages.keyArray() : messages.map(m => m.id || m);
            if (filterOld) {
                messageIDs = messageIDs.filter(id => Date.now() - Snowflake.deconstruct(id).date.getTime() < 1209600000);
            }
            if (messageIDs.length === 0) return Promise.resolve(new Collection());
            if (messageIDs.length === 1) {
                return this.fetchMessage(messageIDs[0]).then(m => m.delete()).then(m => new Collection([
                    [m.id, m]
                ]));
            }
            return this.client.rest.methods.bulkDeleteMessages(this, messageIDs);
        }
        if (!isNaN(messages)) return this.fetchMessages({ limit: messages }).then(msgs => this.bulkDelete(msgs, filterOld));
        throw new TypeError('The messages must be an Array, Collection, or number.');
    }

    /**
     * Marks all messages in this channel as read.
     * <warn>This is only available when using a user account.</warn>
     * @returns {Promise<TextChannel|GroupDMChannel|DMChannel>}
     
     */
    acknowledge() {
        if (!this.lastMessageID) return Promise.resolve(this);
        return this.client.rest.methods.ackTextChannel(this);
    }

    _cacheMessage(message) {
        const maxSize = this.client.options.messageCacheMaxSize;
        if (maxSize === 0) return null;
        if (this.messages.size >= maxSize && maxSize > 0) this.messages.delete(this.messages.firstKey());
        this.messages.set(message.id, message);
        return message;
    }
}

/** @lends TextBasedChannel.prototype */
const Deprecated = {
    /**
     * Send a message to this channel.
     * @param {StringResolvable} [content] Text for the message
     * @param {MessageOptions} [options={}] Options for the message
     * @returns {Promise<Message|Message[]>}
     
     * @example
     * // Send a message
     * channel.sendMessage('hello!')
     *  .then(message => console.log(`Sent message: ${message.content}`))
     *  .catch(console.error);
     */
    sendMessage(content, options) {
        return this.send(content, options);
    },

    /**
     * Send an embed to this channel.
     * @param {RichEmbed|Object} embed Embed for the message
     * @param {string} [content] Text for the message
     * @param {MessageOptions} [options] Options for the message
     * @returns {Promise<Message>}
     */
    sendEmbed(embed, content, options) {
        if (!options && typeof content === 'object' && !(content instanceof Array)) {
            options = content;
            content = '';
        } else if (!options) {
            options = {};
        }
        return this.send(content, Object.assign(options, { embed }));
    },

    /**
     * Send files to this channel.
     * @param {FileOptions[]|string[]} files Files to send with the message
     * @param {StringResolvable} [content] Text for the message
     * @param {MessageOptions} [options] Options for the message
     * @returns {Promise<Message>}
     
     */
    sendFiles(files, content, options = {}) {
        return this.send(content, Object.assign(options, { files }));
    },

    /**
     * Send a file to this channel.
     * @param {BufferResolvable} attachment File to send
     * @param {string} [name='file.jpg'] Name and extension of the file
     * @param {StringResolvable} [content] Text for the message
     * @param {MessageOptions} [options] Options for the message
     * @returns {Promise<Message>}
     
     */
    sendFile(attachment, name, content, options = {}) {
        return this.send({ files: [{ attachment, name }], content, options });
    },

    /**
     * Send a code block to this channel.
     * @param {string} lang Language for the code block
     * @param {StringResolvable} content Content of the code block
     * @param {MessageOptions} [options] Options for the message
     * @returns {Promise<Message|Message[]>}
     
     */
    sendCode(lang, content, options = {}) {
        return this.send(content, Object.assign(options, { code: lang }));
    },
};

for (const key of Object.keys(Deprecated)) {
    TextBasedChannel.prototype[key] = Deprecated[key]
}

exports.applyToClass = (structure, full = false, ignore = []) => {
    const props = ['send', 'sendMessage', 'sendEmbed', 'sendFile', 'sendFiles', 'sendCode'];
    if (full) {
        props.push(
            '_cacheMessage',
            'acknowledge',
            'fetchMessages',
            'fetchMessage',
            'search',
            'lastMessage',
            'lastPinAt',
            'bulkDelete',
            'startTyping',
            'stopTyping',
            'typing',
            'typingCount',
            'fetchPinnedMessages',
            'createCollector',
            'createMessageCollector',
            'awaitMessages'
        );
    }
    for (const prop of props) {
        if (ignore.includes(prop)) continue;
        Object.defineProperty(structure.prototype, prop, Object.getOwnPropertyDescriptor(TextBasedChannel.prototype, prop));
    }
};