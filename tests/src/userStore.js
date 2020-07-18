import { readable, writable, get } from "svelte/store";

export const accessToken = writable("");
export const IDToken = writable("");

export const expireAt = writable("");
