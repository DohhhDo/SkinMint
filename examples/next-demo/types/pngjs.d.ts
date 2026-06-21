declare module "pngjs" {
  export class PNG {
    constructor(options?: { width?: number; height?: number; fill?: boolean });
    width: number;
    height: number;
    data: Buffer;
    static sync: { read(buf: Buffer): PNG; write(png: PNG): Buffer };
  }
}
