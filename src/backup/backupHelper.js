import { app } from "../platform";
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const EventEmitter = require('events');

class BackupHelper extends EventEmitter {
    constructor() {
        super();
        this.backupServer = null;
        this.backupSaveDir = null;
        this.currentFileCount = 0;
        this.expectedFileCount = 0;
        this.isBackupCompleting = false;
        this.completionTimer = null;
    }

    getBackupDirectory() {
        // Get user data directory
        const userData = app.getPath('userData');
        const backupDir = path.join(userData, 'Backups');

        // Ensure directory exists
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, {recursive: true});
        }

        return backupDir;
    }

    startBackupServer() {
        return new Promise((resolve, reject) => {
            try {
                // Close existing server if any
                this.closeBackupServer();

                // Reset state
                this.backupSaveDir = null;
                this.currentFileCount = 0;
                this.expectedFileCount = 0;
                this.isBackupCompleting = false;
                this.resetCompletionTimer();

                // Get local IP
                const getLocalIP = () => {
                    const interfaces = os.networkInterfaces();
                    for (const name of Object.keys(interfaces)) {
                        for (const iface of interfaces[name]) {
                            if (iface.family === 'IPv4' && !iface.internal) {
                                return iface.address;
                            }
                        }
                    }
                    return '127.0.0.1';
                };

                const ip = getLocalIP();
                const maxRetries = 10;
                let retryCount = 0;

                const getRandomPort = () => {
                    return Math.floor(Math.random() * (60000 - 10000 + 1)) + 10000;
                };

                const tryStartServer = (port) => {
                    const server = http.createServer((req, res) => {
                        if (req.method === 'POST' && req.url === '/backup') {
                            const chunks = [];
                            let size = 0;

                            req.on('data', (chunk) => {
                                chunks.push(chunk);
                                size += chunk.length;
                            }).on('end', async () => {
                                try {
                                    const buffer = Buffer.concat(chunks);
                                    this.saveBackupFile(buffer);
                                    res.writeHead(200, {'Content-Type': 'text/plain'});
                                    res.end('OK');
                                } catch (error) {
                                    console.error('Failed to save backup file:', error);
                                    res.writeHead(500, {'Content-Type': 'text/plain'});
                                    res.end('Error');
                                }
                            });
                        } else if (req.method === 'POST' && req.url === '/backup_complete') {
                            const chunks = [];

                            req.on('data', (chunk) => {
                                chunks.push(chunk);
                            }).on('end', () => {
                                try {
                                    const buffer = Buffer.concat(chunks);
                                    // Read file count (4 bytes, little endian)
                                    const expectedFileCount = buffer.readInt32LE(0);
                                    const receivedFileCount = this.currentFileCount;

                                    this.expectedFileCount = expectedFileCount;

                                    console.log(`Backup completion notification received. iOS sent ${expectedFileCount} files, PC received ${receivedFileCount} files`);

                                    res.writeHead(200, {'Content-Type': 'text/plain'});
                                    res.end('OK');

                                    if (receivedFileCount >= expectedFileCount) {
                                        setTimeout(() => {
                                            this.onBackupComplete();
                                        }, 100);
                                    } else {
                                        console.log(`Waiting for remaining files... (Missing ${expectedFileCount - receivedFileCount})`);
                                        this.resetCompletionTimer();
                                    }
                                } catch (error) {
                                    console.error('Failed to process backup completion request:', error);
                                    res.writeHead(500, {'Content-Type': 'text/plain'});
                                    res.end('Error');
                                }
                            });
                        } else {
                            res.writeHead(404);
                            res.end('Not Found');
                        }
                    });

                    server.listen(port, '0.0.0.0', () => {
                        console.log(`Backup server started: ${ip}:${port}`);
                        this.backupServer = server;
                        resolve({ ip, port });
                    });

                    server.on('error', (error) => {
                        console.error(`Port ${port} start failed:`, error.code);
                        retryCount++;

                        if (retryCount < maxRetries) {
                            const newPort = getRandomPort();
                            console.log(`Retry ${retryCount}, using port ${newPort}`);
                            tryStartServer(newPort);
                        } else {
                            console.error('Max retries reached, server start failed');
                            this.backupServer = null;
                            reject(new Error(`Failed to start backup server after ${maxRetries} attempts`));
                        }
                    });
                };

                const initialPort = getRandomPort();
                console.log(`Initial attempt to start server, port: ${initialPort}`);
                tryStartServer(initialPort);

            } catch (error) {
                console.error('Server start exception:', error);
                this.backupServer = null;
                reject(error);
            }
        });
    }

    resetCompletionTimer() {
        if (this.completionTimer) {
            clearTimeout(this.completionTimer);
        }

        // Set new timer (30 seconds without new files)
        this.completionTimer = setTimeout(() => {
            this.onBackupComplete();
        }, 30000);
    }

    onBackupComplete() {
        if (this.isBackupCompleting) {
            console.log('Backup already completing, skipping duplicate call');
            return;
        }

        this.isBackupCompleting = true;

        this.emit('complete', {
            count: this.currentFileCount,
            path: this.backupSaveDir
        });

        this.closeBackupServer();
        this.backupSaveDir = null;

        setTimeout(() => {
            this.isBackupCompleting = false;
        }, 1000);
    }

    saveBackupFile(buffer) {
        let offset = 0;

        // Read relative path length
        const pathLength = buffer.readInt32LE(offset);
        offset += 4;

        // Read relative path
        const relativePath = buffer.slice(offset, offset + pathLength).toString('utf8');
        offset += pathLength;

        // Read file data length
        const dataLengthLow = buffer.readInt32LE(offset);
        offset += 4;
        const dataLengthHigh = buffer.readInt32LE(offset);
        offset += 4;

        const dataLength = BigInt(dataLengthLow) + (BigInt(dataLengthHigh) << BigInt(32));

        // Read file data
        const dataStart = offset;
        const dataEnd = Number(BigInt(dataStart) + dataLength);
        const fileData = buffer.slice(dataStart, dataEnd);

        const fileName = path.basename(relativePath);

        // Handle metadata.json or directory creation
        if (this.backupSaveDir === null) {
            const backupDir = path.join(this.getBackupDirectory(), 'received');
            const date = new Date();
            const timestamp = date.toISOString().replace(/[:.]/g, '-').slice(0, -5);
            this.backupSaveDir = path.join(backupDir, `backup_${timestamp}`);

            if (!fs.existsSync(this.backupSaveDir)) {
                fs.mkdirSync(this.backupSaveDir, {recursive: true});
            }

            // If it's metadata.json, we can emit an info event or similar if needed
            // But main progress update is enough
            if (fileName === 'metadata.json') {
                this.emit('start', { path: this.backupSaveDir });
            }
        }

        const filePath = path.join(this.backupSaveDir, relativePath);
        const fileDir = path.dirname(filePath);

        if (!fs.existsSync(fileDir)) {
            fs.mkdirSync(fileDir, {recursive: true});
        }

        fs.writeFileSync(filePath, fileData);

        console.log(`Saved: ${relativePath} (${dataLength} bytes)`);

        this.currentFileCount++;

        this.emit('progress', {
            currentFile: this.currentFileCount,
            currentFileName: path.basename(relativePath),
            backupPath: this.backupSaveDir
        });

        if (this.expectedFileCount > 0 && this.currentFileCount >= this.expectedFileCount) {
            console.log(`Received all ${this.currentFileCount} files, preparing to complete backup`);
            setTimeout(() => {
                this.onBackupComplete();
            }, 200);
        } else {
            this.resetCompletionTimer();
        }
    }

    closeBackupServer() {
        if (this.backupServer) {
            try {
                this.backupServer.close();
                console.log('Backup server closed');
            } catch (e) {
                console.error('Error closing server:', e);
            }
            this.backupServer = null;
        }

        if (this.completionTimer) {
            clearTimeout(this.completionTimer);
            this.completionTimer = null;
        }
    }

    startRestoreServer() {
        return new Promise((resolve, reject) => {
            try {
                this.closeBackupServer(); // Close any existing server

                const getLocalIP = () => {
                    const interfaces = os.networkInterfaces();
                    for (const name of Object.keys(interfaces)) {
                        for (const iface of interfaces[name]) {
                            if (iface.family === 'IPv4' && !iface.internal) {
                                return iface.address;
                            }
                        }
                    }
                    return '127.0.0.1';
                };

                const ip = getLocalIP();
                const maxRetries = 10;
                let retryCount = 0;

                const getRandomPort = () => {
                    return Math.floor(Math.random() * (60000 - 10000 + 1)) + 10000;
                };

                const tryStartServer = (port) => {
                    const server = http.createServer((req, res) => {
                        if (req.method === 'GET' && req.url === '/restore_list') {
                            try {
                                const backupList = this.getBackupList();
                                res.writeHead(200, {'Content-Type': 'application/json'});
                                res.end(JSON.stringify(backupList));
                            } catch (error) {
                                console.error('Failed to get backup list:', error);
                                res.writeHead(500, {'Content-Type': 'text/plain'});
                                res.end('Error');
                            }
                        } else if (req.method === 'GET' && req.url.startsWith('/restore_metadata?')) {
                            const url = new URL(req.url, `http://${req.headers.host}`);
                            const backupPath = url.searchParams.get('path');

                            if (!backupPath) {
                                res.writeHead(400, {'Content-Type': 'text/plain'});
                                res.end('Missing backup path');
                                return;
                            }

                            const metadataPath = path.join(backupPath, 'metadata.json');

                            if (!fs.existsSync(metadataPath)) {
                                res.writeHead(404, {'Content-Type': 'text/plain'});
                                res.end('Metadata file not found');
                                return;
                            }

                            const stat = fs.statSync(metadataPath);
                            const readStream = fs.createReadStream(metadataPath);
                            res.writeHead(200, {
                                'Content-Type': 'application/json',
                                'Content-Length': stat.size
                            });
                            readStream.pipe(res);
                        } else if (req.method === 'GET' && req.url.startsWith('/restore_file?')) {
                            const url = new URL(req.url, `http://${req.headers.host}`);
                            const filePath = url.searchParams.get('path');

                            if (!filePath) {
                                res.writeHead(400, {'Content-Type': 'text/plain'});
                                res.end('Missing file path');
                                return;
                            }

                            if (!fs.existsSync(filePath)) {
                                res.writeHead(404, {'Content-Type': 'text/plain'});
                                res.end('File not found');
                                return;
                            }

                            const stat = fs.statSync(filePath);
                            const readStream = fs.createReadStream(filePath);
                            res.writeHead(200, {
                                'Content-Type': 'application/octet-stream',
                                'Content-Length': stat.size
                            });
                            readStream.pipe(res);
                        } else {
                            res.writeHead(404);
                            res.end('Not Found');
                        }
                    });

                    server.listen(port, '0.0.0.0', () => {
                        console.log(`Restore server started: ${ip}:${port}`);
                        this.backupServer = server;
                        resolve({ ip, port });
                    });

                    server.on('error', (error) => {
                        console.error(`Port ${port} start failed:`, error.code);
                        retryCount++;

                        if (retryCount < maxRetries) {
                            const newPort = getRandomPort();
                            console.log(`Retry ${retryCount}, using port ${newPort}`);
                            tryStartServer(newPort);
                        } else {
                            console.error('Max retries reached, server start failed');
                            this.backupServer = null;
                            reject(new Error(`Failed to start restore server after ${maxRetries} attempts`));
                        }
                    });
                };

                const initialPort = getRandomPort();
                console.log(`Initial attempt to start restore server, port: ${initialPort}`);
                tryStartServer(initialPort);

            } catch (error) {
                console.error('Restore server start exception:', error);
                this.backupServer = null;
                reject(error);
            }
        });
    }

    getBackupList() {
        const backupDir = this.getBackupDirectory();
        const receivedDir = path.join(backupDir, 'received');

        if (!fs.existsSync(receivedDir)) {
            return [];
        }

        const backups = [];
        const subdirs = fs.readdirSync(receivedDir).filter(f => {
            const stat = fs.statSync(path.join(receivedDir, f));
            return stat.isDirectory() && f.startsWith('backup_');
        });

        for (const subdir of subdirs) {
            const backupPath = path.join(receivedDir, subdir);
            const metadataPath = path.join(backupPath, 'metadata.json');

            if (!fs.existsSync(metadataPath)) {
                console.log('Skip backup without metadata.json:', subdir);
                continue;
            }

            let backupInfo = {
                name: subdir,
                time: subdir.replace('backup_', '').replace(/-/g, ':'),
                path: backupPath,
                deviceName: '',
                fileCount: 0,
                conversationCount: 0,
                messageCount: 0,
                mediaFileCount: 0,
                mediaSize: 0
            };

            try {
                const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
                if (metadata.statistics) {
                    backupInfo.conversationCount = metadata.statistics.totalConversations || 0;
                    backupInfo.messageCount = metadata.statistics.totalMessages || 0;
                    backupInfo.mediaFileCount = metadata.statistics.mediaFileCount || 0;
                    backupInfo.mediaSize = metadata.statistics.mediaTotalSize || 0;
                }
                if (metadata.backupTime) {
                    backupInfo.time = metadata.backupTime;
                }
                if (metadata.deviceName) {
                    backupInfo.deviceName = metadata.deviceName;
                }
            } catch (e) {
                console.error('Failed to read metadata.json, skipping:', subdir, e);
                continue;
            }

            const countFiles = (dir) => {
                let totalCount = 0;
                const items = fs.readdirSync(dir);
                for (const item of items) {
                    const fullPath = path.join(dir, item);
                    const stat = fs.statSync(fullPath);
                    if (stat.isDirectory()) {
                        totalCount += countFiles(fullPath);
                    } else {
                        totalCount++;
                    }
                }
                return totalCount;
            };

            backupInfo.fileCount = countFiles(backupPath);
            backups.push(backupInfo);
        }

        backups.sort((a, b) => {
            const timeA = new Date(a.time || 0).getTime();
            const timeB = new Date(b.time || 0).getTime();
            return timeB - timeA;
        });

        return backups;
    }
}

export default new BackupHelper();
