import { WAMessage, WASocket } from '@whiskeysockets/baileys';

// Tipe untuk objek pesan yang disederhanakan (m)
export interface SimpleMessage extends WAMessage {
  // Nomor pengirim
  sender: string;
  // Teks pesan
  text: string;
  // Apakah dari saya (bot)
  fromMe: boolean;
  // JID chat
  chat: string;
  // Fungsi untuk membalas pesan
  reply: (text: string) => Promise<WAMessage>;
  // Pesan yang di-quote
  quoted: SimpleMessage | null;
}

// Tipe untuk argumen fungsi command
export interface CommandArgs {
  ard: WASocket; // instance socket utama
  m: SimpleMessage; // objek pesan
  text: string; // teks setelah command
  prefix: string; // prefix yang digunakan
  command: string; // command yang dieksekusi
}

// Tipe untuk struktur file command
export interface Command {
  command: string | string[];
  tags: string[];
  private?: boolean;
  func: (args: CommandArgs) => Promise<void>;
  before?: (args: { ard: WASocket, m: SimpleMessage }) => Promise<void>;
}
