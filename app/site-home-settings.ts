import defaults from "../cloudfunctions/archive-api/home-defaults.json";
export type HomeSlot = { key: string; label: string; title: string; copy: string; image: string; fileID: string; x: number; y: number };
export type HomeSettings = { revision: number; slots: HomeSlot[] };
export const defaultHomeSettings = (): HomeSettings => ({ revision: 0, slots: defaults.map(slot => ({ ...slot, fileID: "", x: 50, y: 50 })) });
