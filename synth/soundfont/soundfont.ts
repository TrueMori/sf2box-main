// WORD: Uint16
// DWORD: Uint32

// Important document for anyone trying to decipher what this is doing: https://www.synthfont.com/SFSPEC21.PDF
// Soundfonts use the RIFF file structure.

import { SongDocument } from "../../editor/SongDocument";
import { performIntegral } from "../SynthConfig"

interface InstrumentZone {
    minPitch: number,
    maxPitch: number,
    bag: Bag;
    sampleZones: Array<SampleZone>;
}

interface SampleZone {
    name: string;
    low: number;
    opitch: number;
    index: number; //index of sample in samples array
}

interface SoundfontPreset {
    name: string;
    minPitch: number
    maxPitch: number
    bag: Bag;
    instrumentZones: Array<InstrumentZone>;
}

interface SampleInfo {
    name: string,
    lowBound: number,
    highBound: number,
    index: number,
}

interface Bag {
    gens: number[]
    mods: number[]
}

interface Generator {
    op: number
    amt: number
}

interface PHDR {
    name: string,
    bag: number, //index
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
            minPitch: 0,
            maxPitch: 0,
            bag: {gens:[], mods:[]},
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
            let rawSample: Float32Array = new Float32Array;
            let intSample: Float32Array = new Float32Array;

            // RIFF parser
            const decoder = new TextDecoder('ascii');
            const chipWaves: Float32Array[] = [];
            const rawChipWaves: Float32Array[] = [];
            const rawRawChipWaves: Float32Array[] = [];
            const view = new DataView(buffer.buffer);
            const sampleZones: SampleZone[] = [];
            const sampleInfo: SampleInfo[] = [];
            const pbag: Bag[] = [];
            const ibag: Bag[] = [];
            const pgen: Generator[] = [];
            const igen: Generator[] = [];
            const phdr: PHDR[] = [];
            let recordCount = 0;
            let currRecord = 0;
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
                    
                    case 'pbag':
                        recordCount = Math.floor(size / 4);
                        currRecord = 0;
                        const currGens: Generator[] = [];
                        while (currRecord < recordCount - 1) {
                            const recLocation = (currRecord * 4) + postByte;
                            currGens.push({
                                op: view.getUint16(recLocation, true),
                                amt: view.getUint16(recLocation + 2, true),
                            });
                                
                                
                            currRecord + 1;
                        }
                        break;

                    case 'ibag':
                        recordCount = Math.floor(size / 4);
                        currRecord = 0;
                        while (currRecord < recordCount - 1) {
                            const recLocation = (currRecord * 4) + postByte;
                            ibag.push({
                                gen: view.getUint16(recLocation, true),
                                mod: view.getUint16(recLocation + 2, true),
                            });
                            currRecord + 1;
                        }
                        break;

                    case 'pgen':
                        recordCount = Math.floor(size / 4);
                        currRecord = 0;
                        while (currRecord < recordCount - 1) {
                            const recLocation = (currRecord * 4) + postByte;
                            pgen.push({
                                op: view.getUint16(recLocation, true),
                                amt: view.getUint16(recLocation + 2, true),
                            });
                            currRecord + 1;
                        }
                        break;

                    case 'igen':
                        recordCount = Math.floor(size / 4);
                        currRecord = 0;
                        while (currRecord < recordCount - 1) {
                            const recLocation = (currRecord * 4) + postByte;
                            igen.push({
                                op: view.getUint16(recLocation, true),
                                amt: view.getUint16(recLocation + 2, true),
                            });
                            currRecord + 1;
                        }
                        break;

                    case 'phdr': // Name of presets
                        recordCount = Math.floor(size / 38); // Each preset is 38 bytes
                        currRecord = 0;
                        while (currRecord < recordCount - 1) {
                            const recLocation = (currRecord * 38) + postByte;
                            phdr.push({
                                name: decoder.decode(buffer.subarray(recLocation, recLocation + 20)),
                                bag: view.getUint16(recLocation + 22, true),
                            });
                            currRecord++;
                        }
                        currByte += 8 + size + (size % 2);
                        break;

                    case 'shdr': // Sample info
                        recordCount = Math.floor(size / 46) // Each sample is 46 bytes
                        currRecord = 0;
                        while (currRecord < recordCount - 1) {
                            const recLocation = (currRecord * 46) + postByte;
                            sampleInfo.push({
                                name: decoder.decode(buffer.subarray(recLocation, recLocation + 20)),
                                lowBound: view.getUint32(recLocation + 20, true),
                                highBound: view.getUint32(recLocation + 24, true),
                                index: currRecord,
                            });
                            currRecord++;
                        }
                        console.log(sampleZones);
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
                        console.log(intSample.length); //so that the compiler doesnt yell at me about not using it.
                        currByte += 8 + size + (size % 2);
                        break;

                    default:
                        currByte++; //loop through until we find a tag we want
                }
                
            }
            
            //Construct samples from info
            for (let sample of sampleInfo) {
                console.log(sample.name);
                chipWaves[sample.index] = rawSample.subarray(sample.lowBound, sample.highBound);
                rawChipWaves[sample.index] = intSample.subarray(sample.lowBound, sample.highBound);
                rawRawChipWaves[sample.index] = intSample.subarray(sample.lowBound, sample.highBound);
            }

            //Construct presets:
            for (let preset of phdr) {
                presets.push({
                    name: preset.name,
                    minPitch: pbag[preset.bag]
                })
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