const dgram = require('dgram');

class IFacialMocapClient {
    constructor() {
        this.socket = null;
        this.port = 49983; // Default iFacialMocap port
        this.targetIP = null;
        this.faceData = {};
        this.onDataCallback = null;
        this.listening = false;
    }

    /**
     * Initialize the UDP socket and start listening for data.
     * @param {string} targetIP - The IP address of the iPhone running iFacialMocap.
     * @param {number} port - The port to listen on (default 49983).
     */
    connect(targetIP, port = 49983) {
        if (this.socket) {
            this.disconnect();
        }

        this.targetIP = targetIP;
        this.port = port;
        this.socket = dgram.createSocket('udp4');

        this.socket.on('error', (err) => {
            console.error(`[iFacialMocap] Socket error:\n${err.stack}`);
            this.socket.close();
            this.listening = false; // Ensure listening status is updated on error
            if (this.onConnectCallback) {
                this.onConnectCallback(false); // Indicate connection failure
                this.onConnectCallback = null;
            }
        });

        this.socket.on('message', (msg, rinfo) => {
            const dataStr = msg.toString();
            // console.log(`[iFacialMocap] Raw: ${dataStr.substring(0, 100)}...`); // Log start of message
            this.parseData(dataStr);
            if (this.onConnectCallback) {
                this.onConnectCallback(true);
                this.onConnectCallback = null; // Only trigger once per connection attempt/success
            }
        });

        this.socket.on('listening', () => {
            const address = this.socket.address();
            console.log(`[iFacialMocap] Client listening on ${address.address}:${address.port}`);
            this.listening = true;
            // Send initiation packet
            this.sendInitiation();
        });

        this.socket.bind(this.port);
    }

    /**
     * Send the initiation string to the iPhone to start the stream.
     */
    sendInitiation() {
        if (!this.socket || !this.targetIP) return;

        const message = Buffer.from('iFacialMocap_sahuasouryya9218sauhuiayeta91555dy3719');
        this.socket.send(message, this.port, this.targetIP, (err) => {
            if (err) {
                console.error('Failed to send iFacialMocap initiation packet:', err);
            } else {
                console.log('Sent iFacialMocap initiation packet to ' + this.targetIP);
            }
        });
    }

    /**
     * Stop listening and close the socket.
     */
    disconnect() {
        if (this.socket) {
            this.socket.close();
            this.socket = null;
            this.listening = false;
            console.log('IFacialMocap client disconnected');
        }
    }

    /**
     * Parse the pipe-delimited data string from iFacialMocap.
     * Format: blendShape1|value1|blendShape2|value2...
     * @param {string} dataStr 
     */
    parseData(dataStr) {
        // Debug raw data (throttled)
        if (!this.logCounter) this.logCounter = 0;
        if (this.logCounter < 5) {
            console.log('[iFacialMocap] Raw DataStr:', dataStr);
        }

        const parts = dataStr.split('|');
        const newData = {};

        parts.forEach(part => {
            if (!part) return;

            if (part.startsWith('=head#')) {
                // Parse head data. Based on logs:
                // vals[0..2] seem to be Rotation (Degrees)
                // vals[3..5] seem to be Position (Meters?)
                const vals = part.substring(6).split(',');
                if (vals.length >= 6) {
                    newData['headPitch'] = parseFloat(vals[0]);
                    newData['headYaw'] = parseFloat(vals[1]);
                    newData['headRoll'] = parseFloat(vals[2]);
                    newData['headX'] = parseFloat(vals[3]);
                    newData['headY'] = parseFloat(vals[4]);
                    newData['headZ'] = parseFloat(vals[5]);
                }
            } else if (part.startsWith('rightEye#')) {
                // Parse right eye: rightEye#val1,val2,val3
                const vals = part.substring(9).split(',');
                if (vals.length >= 3) {
                    newData['rightEyeRotX'] = parseFloat(vals[0]);
                    newData['rightEyeRotY'] = parseFloat(vals[1]);
                    newData['rightEyeRotZ'] = parseFloat(vals[2]);
                }
            } else if (part.startsWith('leftEye#')) {
                // Parse left eye: leftEye#val1,val2,val3
                const vals = part.substring(8).split(',');
                if (vals.length >= 3) {
                    newData['leftEyeRotX'] = parseFloat(vals[0]);
                    newData['leftEyeRotY'] = parseFloat(vals[1]);
                    newData['leftEyeRotZ'] = parseFloat(vals[2]);
                }
            } else {
                // Assume blendshape: key-value
                const lastDashIndex = part.lastIndexOf('-');
                if (lastDashIndex !== -1) {
                    const key = part.substring(0, lastDashIndex);
                    const valStr = part.substring(lastDashIndex + 1);
                    const value = parseFloat(valStr);
                    if (!isNaN(value)) {
                        newData[key] = value;
                    }
                }
            }
        });

        // Update internal state
        Object.assign(this.faceData, newData);

        if (this.onDataCallback) {
            this.onDataCallback(this.faceData);
        }
    }

    /**
     * Set a callback to be called whenever new face data is parsed.
     * @param {function} callback 
     */
    onFaceData(callback) {
        this.onDataCallback = callback;
    }

    /**
     * Get the current face data.
     * @returns {object}
     */
    getFaceData() {
        return this.faceData;
    }

    /**
     * Set a callback to be called when connection status changes.
     * @param {function} callback 
     */
    onConnect(callback) {
        this.onConnectCallback = callback;
    }
}

// Export as a global or module depending on the environment
if (typeof module !== 'undefined' && module.exports) {
    module.exports = IFacialMocapClient;
} else {
    window.IFacialMocapClient = IFacialMocapClient;
}
