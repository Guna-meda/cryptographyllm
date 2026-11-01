export type Step = string | { text: string; table?: string[][] };

export interface CryptoResult {
  result: string;
  steps: Step[];
}

export interface Params {
  text: string;
  key?: string;
  shift?: number;
  operation: string;
}
