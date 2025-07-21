import { WAMessage, WASocket, proto } from '@whiskeysockets/baileys';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Command, SimpleMessage } from './lib/types.js';
import { db } from './database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cmdFolder = path.join(__dirname, 'cmd');

const commands = new Map<string, Command>();

/**
 * Memuat semua file command dari direktori 'cmd'.
 */
async function loadCommands() {
    const files = await fs.readdir(cmdFolder);
    for (const file of files) {
        if (file.endsWith('.js')) { // Perhatikan, kita load file .js hasil kompilasi TS
            const filePath = path.join(cmdFolder, file);
            // Gunakan import dinamis dengan timestamp untuk cache-busting
            const commandModule = await import(`file://${filePath}?v=${Date.now()}`);
            const cmd: Command = commandModule.default;

            if (Array.isArray(cmd.command)) {
                cmd.command.forEach(alias => commands.set(alias, cmd));
            } else {
                commands.set(cmd.command, cmd);
            }
        }
    }
    console.log(`Berhasil memuat ${commands.size} perintah.`);
}

/**
 * Memproses pesan masuk.
 * @param m Pesan dari Baileys
 * @param ard Instance WASocket
 */
export async function handleMessage(m: WAMessage, ard: WASocket) {
    // Muat ulang perintah jika ada perubahan (untuk development)
    await loadCommands();

    if (!m.message) return;
    const messageType = Object.keys(m.message)[0];
    if (messageType === 'protocolMessage' || messageType === 'senderKeyDistributionMessage') return;

    // Menyederhanakan objek pesan
    const simplifiedMessage = await simplifyMessage(m, ard);
    if (!simplifiedMessage) return;

    // Simpan chat ke database
    db.data.chats.push({
        remoteJid: simplifiedMessage.chat,
        fromMe: simplifiedMessage.fromMe,
        text: simplifiedMessage.text,
        timestamp: Date.now()
    });
    await db.write();

    // Jalankan fungsi `before` dari semua command
    for (const cmd of commands.values()) {
        if (cmd.before) {
            try {
                await cmd.before({ ard, m: simplifiedMessage });
            } catch (e) {
                console.error(`Error di fungsi 'before' command ${cmd.command}:`, e);
            }
        }
    }

    const prefix = /^[\\/!#.]/gi.test(simplifiedMessage.text) ? simplifiedMessage.text.match(/^[\\/!#.]/gi)?.[0] : null;
    if (!prefix) return;

    const [cmdName, ...args] = simplifiedMessage.text.slice(prefix.length).trim().split(/ +/);
    const command = commands.get(cmdName.toLowerCase());
    const text = args.join(' ');

    if (command) {
        try {
            await command.func({ ard, m: simplifiedMessage, text, prefix, command: cmdName });
        } catch (e) {
            console.error(`Error saat menjalankan command ${cmdName}:`, e);
            await simplifiedMessage.reply(`Terjadi error: ${e}`);
        }
    }
}

/**
 * Mengubah objek WAMessage menjadi format yang lebih sederhana dan mudah digunakan.
 * @param m Pesan dari Baileys
 * @param ard Instance WASocket
 */
async function simplifyMessage(m: WAMessage, ard: WASocket): Promise<SimpleMessage | null> {
    const message = m.message;
    if (!message) return null;

    const messageType = Object.keys(message)[0];
    const content = message[messageType as keyof typeof message] as any;

    const text = content.text || content.caption || m.message?.conversation || '';
    const sender = m.key.remoteJid?.endsWith('@g.us') ? m.key.participant || m.key.remoteJid || '' : m.key.remoteJid || '';

    // Fungsi untuk membalas pesan
    const reply = (text: string) => ard.sendMessage(m.key.remoteJid!, { text }, { quoted: m });
    
    // Logika untuk mendapatkan pesan yang di-quote
    let quoted: SimpleMessage | null = null;
    const quotedMsgKey = content?.contextInfo?.quotedMessage;
    if (quotedMsgKey) {
        const quotedWAMessage: WAMessage = {
            key: {
                remoteJid: m.key.remoteJid,
                id: content.contextInfo.stanzaId,
                participant: content.contextInfo.participant
            },
            message: quotedMsgKey
        };
        quoted = await simplifyMessage(quotedWAMessage, ard);
    }


    return {
        ...m,
        sender,
        text,
        fromMe: m.key.fromMe ?? false,
        chat: m.key.remoteJid ?? '',
        reply,
        quoted
    };
}
