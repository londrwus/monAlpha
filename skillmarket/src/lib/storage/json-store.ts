import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const BACKUP_DIR = path.join(DATA_DIR, "backups");
const MAX_BACKUPS = 5;

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

export class JsonStore<T> {
  private filePath: string;
  private data: T | null = null;
  private defaultData: T;
  private filename: string;
  private lastBackup: number = 0;
  private backupInterval: number; // ms

  constructor(filename: string, defaultData: T, backupIntervalHours = 6) {
    this.filePath = path.join(DATA_DIR, filename);
    this.filename = filename;
    this.defaultData = defaultData;
    this.backupInterval = backupIntervalHours * 60 * 60 * 1000;
  }

  private load(): T {
    if (this.data !== null) return this.data;

    ensureDataDir();

    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, "utf-8");
        this.data = JSON.parse(raw) as T;
      } else {
        this.data = structuredClone(this.defaultData);
        this.save();
      }
    } catch {
      // Try to recover from latest backup
      const recovered = this.recoverFromBackup();
      if (recovered) {
        this.data = recovered;
        this.save();
      } else {
        this.data = structuredClone(this.defaultData);
        this.save();
      }
    }

    return this.data!;
  }

  private save(): void {
    ensureDataDir();
    // Write to temp file first, then rename (atomic write)
    const tmpPath = this.filePath + ".tmp";
    fs.writeFileSync(tmpPath, JSON.stringify(this.data, null, 2), "utf-8");
    fs.renameSync(tmpPath, this.filePath);
  }

  private maybeBackup(): void {
    const now = Date.now();
    if (now - this.lastBackup < this.backupInterval) return;

    try {
      ensureBackupDir();
      const base = this.filename.replace(".json", "");
      const ts = new Date().toISOString().replace(/[:.]/g, "-");
      const backupPath = path.join(BACKUP_DIR, `${base}_${ts}.json`);
      fs.copyFileSync(this.filePath, backupPath);
      this.lastBackup = now;
      this.pruneBackups(base);
    } catch {
      // Backup failure is non-critical
    }
  }

  private pruneBackups(base: string): void {
    try {
      const files = fs.readdirSync(BACKUP_DIR)
        .filter((f) => f.startsWith(base) && f.endsWith(".json"))
        .sort()
        .reverse();

      for (const old of files.slice(MAX_BACKUPS)) {
        fs.unlinkSync(path.join(BACKUP_DIR, old));
      }
    } catch {
      // Non-critical
    }
  }

  private recoverFromBackup(): T | null {
    try {
      ensureBackupDir();
      const base = this.filename.replace(".json", "");
      const files = fs.readdirSync(BACKUP_DIR)
        .filter((f) => f.startsWith(base) && f.endsWith(".json"))
        .sort()
        .reverse();

      for (const file of files) {
        try {
          const raw = fs.readFileSync(path.join(BACKUP_DIR, file), "utf-8");
          return JSON.parse(raw) as T;
        } catch {
          continue;
        }
      }
    } catch {
      // No backups available
    }
    return null;
  }

  get(): T {
    return this.load();
  }

  update(fn: (current: T) => T): T {
    const current = this.load();
    this.data = fn(current);
    this.save();
    this.maybeBackup();
    return this.data;
  }

  reset(): void {
    this.data = structuredClone(this.defaultData);
    this.save();
  }

  /** Force a backup right now */
  backup(): void {
    this.load();
    this.lastBackup = 0;
    this.maybeBackup();
  }
}
