






import { obfuscateData, deobfuscateData, isObfuscated } from '@/utils/encryption';

interface StorageOptions {




  obfuscate?: boolean;
  encrypt?: boolean;
}

class ObfuscatedStorageService {



  setItem(key: string, value: unknown, options: StorageOptions = {}): void {
    const obfuscate = options.obfuscate ?? options.encrypt ?? true;

    if (value === null || value === undefined) {
      this.removeItem(key);
      return;
    }

    const stringValue = JSON.stringify(value);
    const storedValue = obfuscate ? obfuscateData(stringValue) : stringValue;

    localStorage.setItem(key, storedValue);
  }




  getItem<T = unknown>(key: string, options: StorageOptions = {}): T | null {
    const obfuscate = options.obfuscate ?? options.encrypt ?? true;

    const raw = localStorage.getItem(key);
    if (raw === null) return null;

    try {
      const decrypted = obfuscate ? deobfuscateData(raw) : raw;
      return JSON.parse(decrypted) as T;
    } catch {

      try {

        if (obfuscate && isObfuscated(raw)) {
          const decrypted = deobfuscateData(raw);

          return decrypted as T;
        }

        return raw as T;
      } catch {

        return null;
      }
    }
  }




  removeItem(key: string): void {
    localStorage.removeItem(key);
  }
}

export const obfuscatedStorage = new ObfuscatedStorageService();
