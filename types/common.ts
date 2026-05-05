export type ISODate = string;

export type UUID = string;

export type Cents = number;

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json }
  | Json[];

export const newId = (): UUID =>
  `id_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;

export const nowIso = (): ISODate => new Date().toISOString();
