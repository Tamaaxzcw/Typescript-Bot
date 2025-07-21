import { Command } from '../lib/types.js';
import { Connection, jdbt } from '../lib/connectionStore.js';
import { Jadibot } from '../lib/jadibot.js';

const command: Command = {
    command: "jadibot",
    tags: ["Jadibot", "Main"],
    private: true,
    func: async ({ m, ard, text }) => {
        const users = [...Connection.conns.values()].map(v => v.user);
        if (users.length > 4) {
            return m.reply('Maaf, slot pemakaian jadibot telah penuh!');
        }

        const who = text ? text.replace(/[^0-9]/g, "") + "@s.whatsapp.net" : m.sender;
        if (!who || who === "@s.whatsapp.net") {
            return m.reply("Nomor yang kamu masukan tidak valid! Contoh: .jadibot 628123456789");
        }

        const userNumber = who.split("@")[0];
        if (Connection.conns.has(userNumber)) {
            return m.reply("Nomor ini sudah menjadi bot!");
        }

        // Encode data untuk dilewatkan ke fungsi 'before'
        const encodedData = Buffer.from(JSON.stringify({ number: userNumber })).toString('base64');

        const sentMsg = await m.reply(`*Pilih Opsi Login untuk ${userNumber}*

1. Pairing Code (Rekomendasi)
2. Scan QR

Balas pesan ini dengan angka pilihan Anda.
encodeData:${encodedData}`);

        // Simpan ID pesan untuk dilacak oleh fungsi 'before'
        (global as any).jdbt.push(sentMsg.key.id);
    },

    before: async ({ ard, m }) => {
        // Cek apakah pesan ini adalah balasan ke pesan jadibot
        const quotedId = m.quoted?.key.id;
        if (quotedId && (global as any).jdbt.includes(quotedId)) {
            
            // Hapus ID dari array agar tidak diproses lagi
            const index = (global as any).jdbt.indexOf(quotedId);
            if (index > -1) {
                (global as any).jdbt.splice(index, 1);
            }

            const quotedText = m.quoted?.text;
            if (!quotedText || !quotedText.includes("encodeData:")) return;

            try {
                const encodedData = quotedText.split("encodeData:")[1];
                const data = JSON.parse(Buffer.from(encodedData, 'base64').toString('utf-8'));
                const choice = m.text.trim();

                if (choice === "1") {
                    await m.reply("Anda memilih Pairing Code. Silakan tunggu, kode akan dikirim ke pesan pribadi Anda.");
                    await Jadibot(data.number + "@s.whatsapp.net", ard, m, true);
                } else if (choice === "2") {
                    await m.reply("Anda memilih Scan QR. Silakan tunggu, QR akan dikirim ke pesan pribadi Anda.");
                    await Jadibot(data.number + "@s.whatsapp.net", ard, m, false);
                } else {
                    await m.reply("Pilihan tidak valid. Silakan balas dengan angka 1 atau 2.");
                }
            } catch (e) {
                console.error("Error parsing jadibot data:", e);
                await m.reply("Terjadi kesalahan saat memproses permintaan Anda.");
            }
        }
    }
};

export default command;
