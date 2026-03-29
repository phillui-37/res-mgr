// Global test setup — polyfill browser APIs unavailable in Node.
const store: Record<string, string> = {};

const localStorageMock = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, val: string) => {
    store[key] = val;
  },
  removeItem: (key: string) => {
    delete store[key];
  },
  clear: () => {
    Object.keys(store).forEach((k) => delete store[k]);
  },
  get length() {
    return Object.keys(store).length;
  },
  key: (index: number) => Object.keys(store)[index] ?? null,
};

Object.defineProperty(globalThis, "localStorage", {
  value: localStorageMock,
  writable: true,
});

const locationMock = { href: "" };
Object.defineProperty(globalThis, "window", {
  value: { location: locationMock, localStorage: localStorageMock },
  writable: true,
  configurable: true,
});

// Export for tests that need direct access to the backing store.
export { store as __localStorageBackingStore, locationMock as __locationMock };
