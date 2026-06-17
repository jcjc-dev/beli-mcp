import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";

export interface DraftPhoto {
  path: string;
  description?: string;
  favoriteDish?: boolean;
}

export interface Draft {
  id: string;
  businessId: number;
  name?: string;
  category: string;
  sentiment: "liked" | "fine" | "disliked";
  visitDate?: string;
  photos: DraftPhoto[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Local, client-side review drafts. Compose a review offline (business,
 * sentiment, date, photos+captions) and submit atomically later. Nothing here
 * touches the Beli API until a draft is submitted — true private drafts.
 */
export class DraftStore {
  private drafts = new Map<string, Draft>();
  private loaded = false;

  constructor(private readonly path: string) {}

  private async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    try {
      const raw = await readFile(this.path, "utf8");
      const arr = JSON.parse(raw) as Draft[];
      for (const d of arr) this.drafts.set(d.id, d);
    } catch {
      /* no file yet */
    }
    this.loaded = true;
  }

  private async persist(): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    await writeFile(this.path, JSON.stringify([...this.drafts.values()], null, 2), {
      mode: 0o600,
    });
  }

  async create(
    input: Omit<Draft, "id" | "photos" | "createdAt" | "updatedAt"> & {
      photos?: DraftPhoto[];
    },
  ): Promise<Draft> {
    await this.ensureLoaded();
    const now = new Date().toISOString();
    const draft: Draft = {
      ...input,
      id: randomUUID().slice(0, 8),
      photos: input.photos ?? [],
      createdAt: now,
      updatedAt: now,
    };
    this.drafts.set(draft.id, draft);
    await this.persist();
    return draft;
  }

  async get(id: string): Promise<Draft | undefined> {
    await this.ensureLoaded();
    return this.drafts.get(id);
  }

  async list(): Promise<Draft[]> {
    await this.ensureLoaded();
    return [...this.drafts.values()];
  }

  async update(id: string, patch: Partial<Draft>): Promise<Draft> {
    await this.ensureLoaded();
    const d = this.drafts.get(id);
    if (!d) throw new Error(`draft ${id} not found`);
    const next = { ...d, ...patch, id: d.id, updatedAt: new Date().toISOString() };
    this.drafts.set(id, next);
    await this.persist();
    return next;
  }

  async addPhoto(id: string, photo: DraftPhoto): Promise<Draft> {
    const d = await this.get(id);
    if (!d) throw new Error(`draft ${id} not found`);
    return this.update(id, { photos: [...d.photos, photo] });
  }

  async discard(id: string): Promise<boolean> {
    await this.ensureLoaded();
    const ok = this.drafts.delete(id);
    if (ok) await this.persist();
    return ok;
  }
}
