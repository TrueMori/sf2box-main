import { SongDocument } from "../../editor/SongDocument";
import {ChipWave} from "../SynthConfig"
import {riffChunks} from 'riff-chunks';

interface InstrumentZone {
    low: number;
    high: number;
    sampleZones: Array<SampleZone>;
}

interface SampleZone {
    low: number;
    high: number;
    sample: number; //index of sample in samples array
}

interface SoundfontPreset {
    name: string
    instrumentZones: Array<InstrumentZone>;
}

export class Soundfont {
    public readonly url: string;
    public readonly name: string;
    public readonly samples: Array<ChipWave>;
    public readonly presets: Array<SoundfontPreset>;
    public readonly success: Boolean;

    public static readonly soundfontURLS: Array<string> = [
        "https://file.garden/ZxBw28OpLwxBlXVc/electric%20piano/African_Percussion.sf2",
        "https://file.garden/ZxBw28OpLwxBlXVc/Bluegrass_Banjo.sf2",
    ];

    public static readonly loadedSoundfonts: Array<Soundfont> = [
    ];

    //For loading purposes
    public static placeholderSoundfont(): Soundfont {
        let presets: SoundfontPreset[] = [{
            name: "Loading...",
            instrumentZones: [],
        }];
        return new Soundfont("Loading...", presets, [], "", false);
    }

    public static async loadSoundfont(url: string, index: number, doc: SongDocument): Promise<Soundfont> {
        return fetch(url).then((response) => {
            if (!response.ok) {
                return Promise.reject(new Error("Couldn't load sample"));
            }
            return response.arrayBuffer();
        }).then((arrayBuffer) => {
            let name: string = "";
            let presets: SoundfontPreset[] = [];

            let buffer = new Uint8Array(arrayBuffer)

            // SF2 files are stored in a RIFF format, so we use a parser. <-- me when i lie :3
            // I am NOT making a parser myself. That'd be, like,
            // reinventing the wheel twenty million times.
            let chunks = riffChunks(buffer)
            console.log(chunks);
            if (!chunks.subChunks)
                return Promise.reject(new Error("sf2 has no data."));
            const infoChunk = chunks.subChunks[0];
            if (!infoChunk?.subChunks)
                return Promise.reject(new Error("sf2 has no info."));

            // Try and get the name of the sf2, if it exists on it.
            const nameChunk = infoChunk.subChunks.find((chunk) => chunk.chunkId == 'INAM');
            if (nameChunk) {
                const nameBytes = buffer.subarray(nameChunk.chunkData?.start, nameChunk.chunkData?.end);
                name = new TextDecoder('ascii').decode(nameBytes).split('/0')[0];
            }

            // Get the preset names
            const pdtaChunks = chunks.subChunks[2];
            if (pdtaChunks.chunkSize == 0)
                return Promise.reject(new Error("sf2 has no preset data."));

                // Sometimes, the parser doesn't read this part correctly.
                // Basically, manual labor.
            // Find where pdta starts
            const decoder = new TextDecoder('ascii');
            let pdtaOffset = -1;
            for (let i = 0; i < buffer.length - 4; i++) {
                if (decoder.decode(buffer.subarray(i, i+4)) == 'pdta') {
                    pdtaOffset = i;
                }
            }

            // Get presets in pdta
            let offset = pdtaOffset;
            let end = pdtaOffset + pdtaChunks.chunkSize;
            offset += 4 //pdta header
            while (offset + 8 <= end) {
                console.log(offset);
                const idByte = buffer.subarray(offset, offset+4);
                const id = new TextDecoder('ascii').decode(idByte);
                const size = (
                    buffer[offset + 4] |
                    (buffer[offset + 5] << 8) |
                    (buffer[offset + 6] << 16) |
                    (buffer[offset + 7] << 24)
                ) >>> 0;

                //first 20 bytes are the name of the preset.
                if (id == 'phdr') {
                    console.log("found")
                    let cbit = offset + 8;
                    const presetNameBytes = buffer.subarray(cbit, cbit + 20);
                    const presetName = new TextDecoder('ascii').decode(presetNameBytes);
                    const result: SoundfontPreset = {
                        name: presetName,
                        instrumentZones: [],
                    };
                    presets.push(result);
                }
                console.log(id);
                offset += 8 + size + (size%2);
            }
            
            //Construct soundfont from data
            const success = new Soundfont(name, presets, [], url, true);
            console.log(success)
            this.loadedSoundfonts[index] = success;
            
            // TODO: Update the song document so changes are immediate to the soundfont dropdown
            doc.notifier.changed();
            return success;
        });
    }

    constructor(name: string, presets: SoundfontPreset[], samples: ChipWave[], url: string, success: boolean) {
        this.name = name;
        this.presets = presets;
        this.samples = samples;
        this.url = url;
        this.success = true
    }
}