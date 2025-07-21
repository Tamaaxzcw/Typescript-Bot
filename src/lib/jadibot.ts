import makeWASocket, {
    useMultiFileAuthState,
    DisconnectReason,
    WAMessage,
    WASocket
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import { handleMessage } from '../handler.js';
import { SimpleMessage } from './types.js';
import { Connection } from './connectionStore.js';

/**
 * Membuat instance bot baru (Jadibot).
 * @param jid Nomor WhatsApp yang akan dijadikan bot.
 * @param mainAuthSock Socket utama untuk mengirim update.
 * @param m Pesan trigger.
 * @param usePairingCode Apakah menggunakan pairing code atau QR.
 */
export async function Jadibot(jid: string, mainAuthSock: WASocket, m: SimpleMessage, usePairingCode: boolean) {
    const { state, saveCreds } = await useMultiFileAuthState(`jadibot_sessions/${jid.split('@')[0]}`);
    const logger = pino({ level: 'silent' });

    const sock = makeWASocket({
        logger,
        printQRInTerminal: !usePairingCode, // Hanya print QR jika tidak pakai pairing code
        auth: state,
        browser: ['Jadibot-TS', 'Chrome', '1.0.0'],
    });

    // Handle Pairing Code untuk Jadibot
    if (usePairingCode && !sock.authState.creds.registered) {
        try {
            const phoneNumber = jid.split('@')[0];
            const code = await sock.requestPairingCode(phoneNumber);
            await mainAuthSock.sendMessage(m.sender, { text: `Sesi Jadibot untuk ${phoneNumber}\nKode Pairing Anda: *${code}*` });
        } catch (error) {
            console.error('Gagal meminta pairing code untuk Jadibot:', error);
            await mainAuthSock.sendMessage(m.sender, { text: `Gagal memulai sesi Jadibot. Error: ${error}` });
            return;
        }
    }

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr && !usePairingCode) {
            await m.reply('Silakan scan QR code ini untuk menjadi bot. QR akan dikirim melalui pesan pribadi.');
            qrcode.generate(qr, { small: true }, (qrString) => {
                mainAuthSock.sendMessage(m.sender, { text: qrString });
            });
        }

        if (connection === 'close') {
            const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
            if (statusCode !== DisconnectReason.loggedOut) {
                // Sesi tidak valid atau terputus, tidak perlu reconnect otomatis
                await m.reply(`Koneksi Jadibot untuk ${jid} terputus. Silakan ulangi perintah jadibot.`);
            } else {
                await m.reply(`Anda telah logout dari sesi Jadibot.`);
            }
            // Hapus koneksi dari store
            Connection.conns.delete(jid.split('@')[0]);
        } else if (connection === 'open') {
            await m.reply(`Berhasil terhubung sebagai bot! (Nomor: ${jid.split('@')[0]})`);
            // Simpan koneksi ke store
            Connection.conns.set(jid.split('@')[0], sock);
        }
    });

    sock.ev.on('creds.update', saveCreds);

    // Jadibot juga menggunakan handler yang sama
    sock.ev.on('messages.upsert', async (upsert) => {
        const msg = upsert.messages[0];
        if (!msg.key.fromMe && upsert.type === 'notify') {
            await handleMessage(msg, sock);
        }
    });

    return sock;
}
