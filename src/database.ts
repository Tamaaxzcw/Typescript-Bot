import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Helper untuk mendapatkan path absolut, karena kita menggunakan ES Module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, '..', 'data.json');

// Definisikan struktur database
interface UserData {
    name: string;
    level: number;
    // tambahkan properti lain sesuai kebutuhan
}

interface ChatData {
    remoteJid: string;
    fromMe: boolean;
    text: string | null;
    timestamp: number;
}

interface DatabaseSchema {
    users: { [jid: string]: UserData };
    chats: ChatData[];
    // tambahkan skema lain jika perlu
}

// Inisialisasi database default
const defaultData: DatabaseSchema = {
    users: {},
    chats: [],
};

class Database {
    public data: DatabaseSchema;

    constructor() {
        this.data = { ...defaultData };
    }

    /**
     * Membaca data dari file data.json.
     * Jika file tidak ada, akan dibuat dengan data default.
     */
    async read(): Promise<void> {
        try {
            const fileContent = await fs.readFile(dbPath, 'utf-8');
            this.data = JSON.parse(fileContent);
        } catch (error) {
            console.warn(`File database tidak ditemukan di ${dbPath}. Membuat file baru.`);
            await this.write(); // Tulis data default jika file tidak ada
        }
    }

    /**
     * Menulis data saat ini ke file data.json.
     */
    async write(): Promise<void> {
        try {
            await fs.writeFile(dbPath, JSON.stringify(this.data, null, 2));
        } catch (error) {
            console.error('Gagal menulis ke database:', error);
        }
    }
}

// Ekspor instance tunggal dari database agar bisa diakses di seluruh aplikasi
export const db = new Database();
