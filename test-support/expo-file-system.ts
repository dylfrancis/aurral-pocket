/**
 * An in-memory stand-in for expo-file-system's File, Directory, Paths and
 * download tasks. Downloads wait until a test finishes or fails them.
 *
 * jest-setup.ts mocks the module with this, so every test starts from an
 * empty disk after `resetFileSystem()`.
 */

type Download = {
  url: string;
  destination: string;
  headers: Record<string, string>;
  /** iOS's default is a background session. */
  sessionType: "background" | "foreground";
  finish: (bytes: number) => void;
  fail: (message: string) => void;
  cancelled: boolean;
};

const files = new Map<string, number>();
const directories = new Set<string>();
export const downloads: Download[] = [];

function join(parts: unknown[]): string {
  return parts
    .map((part) =>
      typeof part === "string" ? part : (part as { uri: string }).uri,
    )
    .reduce((path, part) => `${path.replace(/\/$/, "")}/${part}`);
}

function parentOf(uri: string): string {
  return uri.slice(0, uri.lastIndexOf("/"));
}

export class File {
  uri: string;
  constructor(...parts: unknown[]) {
    this.uri = join(parts);
  }
  get name(): string {
    return this.uri.slice(this.uri.lastIndexOf("/") + 1);
  }
  get exists(): boolean {
    return files.has(this.uri);
  }
  get size(): number {
    return files.get(this.uri) ?? 0;
  }
  delete(): void {
    if (!files.delete(this.uri)) throw new Error("No such file");
  }

  static createDownloadTask(
    url: string,
    destination: File,
    options: {
      headers?: Record<string, string>;
      sessionType?: "background" | "foreground";
    } = {},
  ) {
    let settle: {
      resolve: (file: File) => void;
      reject: (error: Error) => void;
    } | null = null;
    const download: Download = {
      url,
      destination: destination.uri,
      headers: options.headers ?? {},
      sessionType: options.sessionType ?? "background",
      cancelled: false,
      finish(bytes) {
        files.set(destination.uri, bytes);
        settle?.resolve(new File(destination.uri));
      },
      fail(message) {
        settle?.reject(new Error(message));
      },
    };
    return {
      downloadAsync(): Promise<File> {
        downloads.push(download);
        return new Promise<File>((resolve, reject) => {
          settle = { resolve, reject };
        });
      },
      cancel(): void {
        download.cancelled = true;
        settle?.reject(new Error("cancelled"));
      },
      release(): void {},
    };
  }
}

export class Directory {
  uri: string;
  constructor(...parts: unknown[]) {
    this.uri = join(parts);
  }
  get exists(): boolean {
    return directories.has(this.uri);
  }
  create(): void {
    directories.add(this.uri);
  }
  delete(): void {
    directories.delete(this.uri);
    for (const uri of [...files.keys()]) {
      if (uri.startsWith(`${this.uri}/`)) files.delete(uri);
    }
  }
  list(): File[] {
    return [...files.keys()]
      .filter((uri) => parentOf(uri) === this.uri)
      .map((uri) => new File(uri));
  }
}

export const Paths = {
  get document(): Directory {
    return new Directory("file:///documents");
  },
  get cache(): Directory {
    return new Directory("file:///caches");
  },
};

/** Put a file on the fake disk, as a download from an earlier run would. */
export function writeFakeFile(uri: string, bytes: number): void {
  directories.add(parentOf(uri));
  files.set(uri, bytes);
}

export function fakeFileExists(uri: string): boolean {
  return files.has(uri);
}

export function resetFileSystem(): void {
  files.clear();
  directories.clear();
  downloads.length = 0;
}
