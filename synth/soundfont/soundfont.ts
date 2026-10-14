import { SongDocument } from "../../editor/SongDocument";
import { performIntegral } from "../SynthConfig"

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
    public readonly chipWaves: Float32Array[];
    public readonly rawChipWaves: Float32Array[];
    public readonly rawRawChipWaves: Float32Array[];
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
        
        return new Soundfont("Loading...", presets, [], [], [], "", false);
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
            let buffer = new Uint8Array(arrayBuffer);
            let rawSample[];
            let intSample[];

            // RIFF parser
            const decoder = new TextDecoder('ascii');
            const chipWaves: Float32Array[] = [];
            const rawChipWaves: Float32Array[] = [];
            const rawRawChipWaves: Float32Array[] = [];
            const view = new DataView(buffer.buffer);
            let currByte = 0;
            let postByte = currByte + 8;
            let id: string;
            let size: number;
            while (currByte + 8 <= buffer.length) {
                postByte = currByte + 8;
                id = decoder.decode(buffer.subarray(currByte, currByte + 4));
                size = view.getUint32(currByte + 4, true);

                switch (id) {
                    case 'INAM': // Name of soundbank
                        console.log('Name');
                        name = decoder.decode(buffer.subarray(postByte, postByte + size));
                        currByte += 8 + size + (size % 2);
                        break;

                    case 'phdr': // Name of presets
                        //name is always 20 bytes long
                        console.log('Preset');
                        const presetName = decoder.decode(buffer.subarray(postByte, postByte + 20));
                        const result: SoundfontPreset = {
                            name: presetName,
                            instrumentZones: [],
                        };
                        presets.push(result);
                        currByte += 8 + size + (size % 2);
                        break;
                    
                    case 'smpl': // Raw sample data
                        console.log('Sample');
                        const samples = new Float32Array(Math.floor(size / 2));
                        for (let i = 0; i < samples.length; i++) {
                            samples[i] = (view.getInt16(postByte + i * 2, true) / 32768);
                        }
                        rawSample = centerWave(Array.from(samples));
                        intSample = performIntegral(rawSample);
                        currByte += 8 + size + (size % 2);
                        break;

                    default:
                        currByte++; //loop through until we find a tag we want
                }
                
            }
            
            //Construct soundfont from data
            const success = new Soundfont(name, presets, chipWaves, rawChipWaves, rawRawChipWaves, url, true);
            console.log(success)
            this.loadedSoundfonts[index] = success;
            
            // TODO: Make this a bit more specific
            doc.notifier.changed();
            return success;
        });
    }

    constructor(name: string, presets: SoundfontPreset[], chipWaves: Float32Array[], rawChipWaves: Float32Array[], rawRawChipWaves: Float32Array[], url: string, success: boolean) {
        this.name = name;
        this.presets = presets;
        this.chipWaves = chipWaves;
        this.rawChipWaves = rawChipWaves;
        this.rawRawChipWaves = rawRawChipWaves;
        this.url = url;
        this.success = true
    }
}

// Borrowed from Config. TODO: idk but stop repeating code
function centerWave(wave: Array<number>): Float32Array {
    let sum: number = 0.0;
    for (let i: number = 0; i < wave.length; i++) sum += wave[i];
    const average: number = sum / wave.length;
    for (let i: number = 0; i < wave.length; i++) wave[i] -= average;
    performIntegral(wave);
    // The first sample should be zero, and we'll duplicate it at the end for easier interpolation.
    wave.push(0);
    return new Float32Array(wave);
}