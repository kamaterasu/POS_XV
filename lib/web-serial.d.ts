/* types/web-serial.d.ts */
interface SerialPort {
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  readable: ReadableStream<Uint8Array> | null;
  writable: WritableStream<Uint8Array> | null;
}
interface Navigator {
  serial: {
    requestPort(options?: any): Promise<SerialPort>;
    getPorts(): Promise<SerialPort[]>;
  };
}
