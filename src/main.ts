import makeWASocket, {
    useMultiFileAuthState,
    DisconnectReason,
    makeInMemoryStore,
} from '@whiskeysockets/baileys';
import pino from 'pino';
import { Boom } from '@hapi/boom';
import { handleMessage } from './handler.js';
import { db } from './database.js';

const store = makeInMemoryStore({ logger: pino().child({ level: 'silent', stream: 'store' }) });

async function connectToWhatsApp() {
    // Baca database sebelum memulai
    await db.read();
    
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    const logger = pino({ level: 'silent' });

    const sock = makeWASocket({
        logger,
        printQRInTerminal: false, // Kita akan handle pairing code secara manual
        auth: state,
        browser: ['My-TS-Bot', 'Chrome', '1.0.0'],
    });

    store?.bind(sock.ev);

    // Handle Pairing Code
    if (!sock.authState.creds.registered) {
        const phoneNumber = await new Promise<string>(resolve => {
            const rl = import('readline').then(readline => {
                const r = readline.createInterface({
                    input: process.stdin,
                    output: process.stdout
                });
                r.question('Masukkan nomor WhatsApp Anda (dengan kode negara, contoh: 6281234567890): ', (answer) => {
                    r.close();
                    resolve(answer);
                });
            });
        });

        try {
            const code = await sock.requestPairingCode(phoneNumber);
            console.log(`Kode Pairing Anda: ${code}`);
        } catch (error) {
            console.error('Gagal meminta pairing code:', error);
            return;
        }
    }

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Koneksi terputus karena ', lastDisconnect?.error, ', mencoba menghubungkan kembali...', shouldReconnect);
            if (shouldReconnect) {
                connectToWhatsApp();
            }
        } else if (connection === 'open') {
            console.log('Berhasil terhubung ke WhatsApp');
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.key.fromMe && m.type === 'notify') {
             await handleMessage(msg, sock);
        }
    });
}

// Jalankan bot
connectToWhatsApp();
