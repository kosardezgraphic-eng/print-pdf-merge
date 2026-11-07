declare module 'utif' {
  export interface IFD {
    width: number;
    height: number;
    data: Uint8Array;
    t282?: number[]; // XResolution
    t283?: number[]; // YResolution
    t296?: number[]; // ResolutionUnit (2 = inch, 3 = cm)
    [key: string]: unknown;
  }

  export function decode(buffer: ArrayBuffer | Uint8Array): IFD[];
  export function decodeImage(buffer: ArrayBuffer | Uint8Array, ifd: IFD): void;
  export function toRGBA8(ifd: IFD): Uint8Array;
}
