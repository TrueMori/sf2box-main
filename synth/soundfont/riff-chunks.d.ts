declare module 'riff-chunks' {
    interface ChunkData {
        start: number;
        end: number;
    }

    interface RiffChunk {
        chunkId: string;
        chunkSize: number;
        format?: string;
        subChunks?: RiffChunk[];
        chunkData?: ChunkData;
    }

    function riffChunks(buffer: Uint8Array): RiffChunk;
    function findChunk(
        chunks: RiffChunk[],
        chunkId: string,
        multiple?: boolean
    ): RiffChunk | RiffChunk[] | undefined;

    export { riffChunks, findChunk };
}