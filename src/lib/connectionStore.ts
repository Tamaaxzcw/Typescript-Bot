import { WASocket } from '@whiskeysockets/baileys';

/**
 * Class untuk menyimpan dan mengelola koneksi Jadibot.
 * Menggunakan Map untuk menyimpan koneksi dengan key nomor telepon.
 */
class ConnectionStore {
    public conns: Map<string, WASocket>;

    constructor() {
        this.conns = new Map<string, WASocket>();
    }
}

// Ekspor instance tunggal agar bisa diakses di seluruh aplikasi
export const Connection = new ConnectionStore();

// Global variable untuk menyimpan ID pesan jadibot yang menunggu balasan
if (!('jdbt' in global)) {
    (global as any).jdbt = [];
}
