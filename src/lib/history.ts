export interface Generation {
  id: string;
  createdAt: number;
  text: string;
  modelId: string;
  modelName: string;
  voiceId: string;
  voiceName: string;
  device: string;
  dtype: string;
  speed: number;
  duration: number;
  generationMs: number;
  samplingRate: number;
  blob: Blob;
  peaks: number[];
}

const DATABASE_NAME = "resonance-voice-history";
const STORE_NAME = "generations";
const CREATED_AT_INDEX = "createdAt";
const MAX_GENERATIONS = 20;

let databasePromise: Promise<IDBDatabase> | undefined;

function openDatabase(): Promise<IDBDatabase> {
  if (!databasePromise) {
    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE_NAME, 1);
      request.onupgradeneeded = () => {
        const store = request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex(CREATED_AT_INDEX, "createdAt");
      };
      request.onsuccess = () => {
        request.result.onversionchange = () => request.result.close();
        resolve(request.result);
      };
      request.onerror = () => reject(request.error ?? new Error("Could not open generation history"));
    });
    databasePromise.catch(() => {
      databasePromise = undefined;
    });
  }
  return databasePromise;
}

function transactionError(transaction: IDBTransaction): Error {
  return transaction.error ?? new Error("Generation history transaction failed");
}

export async function listGenerations(): Promise<Generation[]> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const generations: Generation[] = [];
    const request = transaction.objectStore(STORE_NAME).index(CREATED_AT_INDEX).openCursor(null, "prev");
    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        generations.push(cursor.value as Generation);
        cursor.continue();
      }
    };
    transaction.oncomplete = () => resolve(generations);
    transaction.onerror = () => reject(transactionError(transaction));
    transaction.onabort = () => reject(transactionError(transaction));
  });
}

export async function saveGeneration(generation: Generation): Promise<void> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    store.put(generation);
    const countRequest = store.count();
    countRequest.onsuccess = () => {
      let excess = countRequest.result - MAX_GENERATIONS;
      if (excess <= 0) return;

      const cursorRequest = store.index(CREATED_AT_INDEX).openCursor();
      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result;
        if (!cursor || excess <= 0) return;
        cursor.delete();
        excess -= 1;
        cursor.continue();
      };
    };
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transactionError(transaction));
    transaction.onabort = () => reject(transactionError(transaction));
  });
}

export async function deleteGeneration(id: string): Promise<void> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).delete(id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transactionError(transaction));
    transaction.onabort = () => reject(transactionError(transaction));
  });
}
