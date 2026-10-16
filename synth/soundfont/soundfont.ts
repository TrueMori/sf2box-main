// WORD: Uint16
// DWORD: Uint32
// CHAR: int8

// Important document for anyone trying to decipher what this is doing: https://www.synthfont.com/SFSPEC21.PDF
// Soundfonts use the RIFF file structure.

import { Dictionary, performIntegral } from "../SynthConfig"

const OPS: Dictionary<number> = {
    instrument: 41,
    keyRange: 43,
    sampleID: 53,
}

interface Instrument {
    name: string,
    minPitch: number,
    maxPitch: number,
    globalGens: Generator[],
    instrumentZones: InstrumentZone[],
}

interface Preset {
    name: string;
    minPitch: number
    maxPitch: number
    globalGens: Generator[],
    presetZones: PresetZone[];
}

interface InstrumentZone {
    minPitch: number,
    maxPitch: number,
    sampleIndex: number,
    gens: Generator[],
}

interface PresetZone {
    minPitch: number,
    maxPitch: number,
    instrument: Instrument,
    gens: Generator[],
}

interface SampleInfo {
    name: string,
    index: number,
    sampleStart: number,
    sampleEnd: number,
    loopStart: number,
    loopEnd: number,
    sampleRate: number,
    originalPitch: number,
    pCorrection: number;
}

interface Bag {
    genIndex: number
    modIndex: number
}

interface Generator {
    op: number
    amt: number
}

interface TypeInfo {
    name: string,
    bagIndex: number,
}

interface PHDR extends TypeInfo { //these are just for organization
}

interface INST extends TypeInfo {
}

export class Soundfont {
    public readonly url: string;
    public readonly name: string;
    public readonly chipWaves: Float32Array[];
    public readonly rawChipWaves: Float32Array[];
    public readonly rawRawChipWaves: Float32Array[];
    public readonly presets: Preset[];
    public readonly success: Boolean;
    public readonly sampleInfo: SampleInfo[];

    public static readonly soundfontURLS: Array<string> = [
        "https://file.garden/ZxBw28OpLwxBlXVc/Bluegrass_Banjo.sf2",
        "https://file.garden/ZxBw28OpLwxBlXVc/electric%20piano/African_Percussion.sf2",
        "https://file.garden/ZxBw28OpLwxBlXVc/SRX_Acoustic_Bass.sf2",
    ];

    public static readonly loadedSoundfonts: Array<Soundfont> = [
    ];

    //For loading purposes
    public static placeholderSoundfont(): Soundfont {
        let presets: Preset[] = [{
            name: "Loading...",
            presetZones: [],
            globalGens: [],
            minPitch: 0,
            maxPitch: 0,
        }];
        
        return new Soundfont("Loading...", presets, [], [], [], [], "", false);
    }

    //TODO: make the document not any, right now its a circular dependancy
    public static async loadSoundfont(url: string, index: number, doc: any): Promise<Soundfont> {
        return fetch(url).then((response) => {
            if (!response.ok) {
                return Promise.reject(new Error("Couldn't load sample"));
            }
            return response.arrayBuffer();
        }).then((arrayBuffer) => {
            let name: string = "";
            let presets: Preset[] = [];
            let buffer = new Uint8Array(arrayBuffer);
            let rawSample: Float32Array = new Float32Array;
            let intSample: Float32Array = new Float32Array;

            // RIFF parser
            const decoder = new TextDecoder('ascii');
            const chipWaves: Float32Array[] = [];
            const rawChipWaves: Float32Array[] = [];
            const rawRawChipWaves: Float32Array[] = [];
            const view = new DataView(buffer.buffer);
            const sampleInfo: SampleInfo[] = [];
            const pbag: Bag[] = [];
            const ibag: Bag[] = [];
            const pgen: Generator[] = [];
            const igen: Generator[] = [];
            const phdr: PHDR[] = [];
            const inst: INST[] = [];
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
                    
                    case 'pbag': // Holds generators and modulators
                        recordCount = Math.floor(size / 4);
                        currRecord = 0;
                        while (currRecord < recordCount) {
                            const recLocation = (currRecord * 4) + postByte;
                            pbag.push({
                                genIndex: view.getUint16(recLocation, true),
                                modIndex: view.getUint16(recLocation + 2, true),
                            });  
                            currRecord++;
                        }
                        currByte += 8 + size + (size % 2);
                        break;

                    case 'ibag':
                        recordCount = Math.floor(size / 4);
                        currRecord = 0;
                        while (currRecord < recordCount) {
                            const recLocation = (currRecord * 4) + postByte;
                            ibag.push({
                                genIndex: view.getUint16(recLocation, true),
                                modIndex: view.getUint16(recLocation + 2, true),
                            });
                            currRecord++;
                        }
                        currByte += 8 + size + (size % 2);
                        break;

                    case 'pgen': // Operators and amounts
                        recordCount = Math.floor(size / 4);
                        currRecord = 0;
                        while (currRecord < recordCount) {
                            const recLocation = (currRecord * 4) + postByte;
                            pgen.push({
                                op: view.getUint16(recLocation, true),
                                amt: view.getUint16(recLocation + 2, true),
                            })
                            currRecord++;
                        }
                        currByte += 8 + size + (size % 2);
                        break;

                    case 'igen':
                        recordCount = Math.floor(size / 4);
                        currRecord = 0;
                        while (currRecord < recordCount) {
                            const recLocation = (currRecord * 4) + postByte;
                            igen.push({
                                op: view.getUint16(recLocation, true),
                                amt: view.getUint16(recLocation + 2, true),
                            });
                            currRecord++;
                        }
                        currByte += 8 + size + (size % 2);
                        break;

                    case 'inst': // Instrument info
                        recordCount = Math.floor(size / 22)
                        currRecord = 0;
                        while (currRecord < recordCount) {
                            const recLocation = (currRecord * 22) + postByte;
                           inst.push({
                                name: decoder.decode(buffer.subarray(recLocation, recLocation + 20)),
                                bagIndex: view.getUint16(recLocation + 20, true),
                            });
                            currRecord++;
                        }
                        currByte += 8 + size + (size % 2);
                        break;

                    case 'phdr': // Preset info
                        recordCount = Math.floor(size / 38); // Each preset is 38 bytes
                        currRecord = 0;
                        while (currRecord < recordCount) {
                            const recLocation = (currRecord * 38) + postByte;
                            phdr.push({
                                name: decoder.decode(buffer.subarray(recLocation, recLocation + 20)),
                                bagIndex: view.getUint16(recLocation + 24, true),
                            });
                            currRecord++;
                        }
                        currByte += 8 + size + (size % 2);
                        break;

                    case 'shdr': // Sample info
                        recordCount = Math.floor(size / 46) // Each sample is 46 bytes
                        currRecord = 0;
                        while (currRecord < recordCount) {
                            const recLocation = (currRecord * 46) + postByte;
                            sampleInfo.push({
                                name: decoder.decode(buffer.subarray(recLocation, recLocation + 20)),
                                sampleStart: view.getUint32(recLocation + 20, true),
                                sampleEnd: view.getUint32(recLocation + 24, true),
                                loopStart: view.getUint32(recLocation + 28, true),
                                loopEnd: view.getUint32(recLocation + 32, true),
                                sampleRate: view.getUint32(recLocation + 36, true),
                                originalPitch: view.getUint8(recLocation + 40),
                                pCorrection: view.getInt8(recLocation + 41),
                                index: currRecord,
                            });
                            currRecord++;
                        }
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

            const presetList = phdr.slice(); // Remove terminator entries
            const instrumentList = inst.slice();
            presetList.pop();
            instrumentList.pop();
            
            //Construct samples from info
            for (let sample of sampleInfo) {
                chipWaves[sample.index] = rawSample.subarray(sample.sampleStart, sample.sampleEnd);
                rawChipWaves[sample.index] = intSample.subarray(sample.sampleStart, sample.sampleEnd);
                rawRawChipWaves[sample.index] = intSample.subarray(sample.sampleStart, sample.sampleEnd);
            }

            //Construct instruments:
            const instruments: Instrument[] = [];
            let index = 0;
            for (let instrument of instrumentList) {
                const bagRange: number[] = this.getBagRange(index, inst);
                const generators: Generator[] = this.getGlobalInstrumentGenerators(ibag, igen);
                const global: number = (generators.length > 0) ? 0 : 1;
                const minPitch = this.getKeyRange(generators)[0];
                const maxPitch = this.getKeyRange(generators)[1];
                const instrumentZones: InstrumentZone[] = [];
                for (let i = bagRange[0]; i < bagRange[1] - global; i++) { //account for terminator
                    const zoneGens = this.getInstrumentBagGenerators(i, ibag, igen);
                    const mnPitch = this.getKeyRange(zoneGens)[0];
                    const mxPitch = this.getKeyRange(zoneGens)[1];
                    const sampleIndex = this.getGensOfType(zoneGens, OPS.sampleID)[0];
                    instrumentZones.push({
                        minPitch: mnPitch,
                        maxPitch: mxPitch,
                        sampleIndex: sampleIndex,
                        gens: zoneGens,
                    });
                }
                instruments.push({
                    name: instrument.name,
                    minPitch: minPitch,
                    maxPitch: maxPitch,
                    globalGens: this.getGlobalInstrumentGenerators(ibag, igen),
                    instrumentZones: instrumentZones,
                });
                index++;
            }

            //Construct presets:
            index = 0;
            for (let preset of presetList) {
                const bagRange: number[] = this.getBagRange(index, phdr);   
                const generators: Generator[] = this.getGlobalPresetGenerators(pbag, pgen);
                const global: number = (generators.length > 0) ? 0 : 1;
                const minPitch = this.getKeyRange(generators)[0];
                const maxPitch = this.getKeyRange(generators)[1];
                const presetZones: PresetZone[] = [];
                for (let i = bagRange[0]; i < bagRange[1] - global; i++) {
                    console.log("generating presetZone");
                    const zoneGens = this.getPresetBagGenerators(i, pbag, pgen);
                    const mnPitch = this.getKeyRange(zoneGens)[0];  
                    const mxPitch = this.getKeyRange(zoneGens)[1];
                    const instIndex = this.getGensOfType(zoneGens, OPS.instrument)[0];
                    const instrument = instruments[instIndex];
                    presetZones.push({
                        minPitch: mnPitch,
                        maxPitch: mxPitch,
                        instrument: instrument,
                        gens: zoneGens,
                    });
                    console.log(presetZones);
                }
                presets.push({
                    name: preset.name,
                    minPitch: minPitch,
                    maxPitch: maxPitch,
                    globalGens: this.getGlobalInstrumentGenerators(ibag, igen),
                    presetZones: presetZones,
                });
                index++;
            }

            //Construct soundfont from data
            const success = new Soundfont(name, presets, chipWaves, rawChipWaves, rawRawChipWaves, sampleInfo, url, true);
            this.loadedSoundfonts[index] = success;
            console.log(success);
            
            // TODO: Make this a bit more specific
            doc.notifier.changed();
            return success;
        });
    }

    private static getBagRange(instIndex: number, list: TypeInfo[]): number[] {
        return [list[instIndex].bagIndex, list[instIndex + 1].bagIndex];
    }

    private static getGlobalInstrumentGenerators(bags: Bag[], gens: Generator[]): Generator[] {
        let generators: Generator[] = [];
        let start = bags[0].genIndex;
        let end = bags[1].genIndex;

        for (let i = start; i < end; i++) {
            generators.push(gens[i]);
        }

        if (generators.find((gen) => gen.op == OPS.sampleID)) {
            return generators;
        } else {
            return [];
        }
    }

    private static getGlobalPresetGenerators(bags: Bag[], gens: Generator[]): Generator[] {
        let generators: Generator[] = [];
        let start = bags[0].genIndex;
        let end = bags[1].genIndex;

        for (let i = start; i < end; i++) {
            generators.push(gens[i]);
        }

        if (generators.find((gen) => gen.op == OPS.instrument)) {
            return generators;
        } else {
            return [];
        }
    }

    private static getPresetBagGenerators(bagIndex: number, bags: Bag[], gens: Generator[]): Generator[] {
        // Check for a global bag
        let global = 0; 
        const gStart = bags[0].genIndex;
        const gEnd = bags[1].genIndex;
        if (!gens.slice(gStart, gEnd).find((g) => g.op == OPS.instrument))
            global = 1;
        
        const genResult: Generator[] = [];
        const start = bags[bagIndex + global].genIndex;
        const end = bags[bagIndex + global + 1].genIndex;
        
        for (let i = start; i < end; i++) {
            genResult.push(gens[i]);
        }
        
        return gens;
    }

    private static getInstrumentBagGenerators(bagIndex: number, bags: Bag[], gens: Generator[]): Generator[] {
        // Check for a global bag
        let global = 0;
        const tempGens = gens.slice();
        const gStart = bags[0].genIndex;
        const gEnd = bags[1].genIndex;
        if (!tempGens.slice(gStart, gEnd).find((g) => g.op == OPS.sampleID))
            global = 1;

        const genResult: Generator[] = [];
        const start = bags[bagIndex + global].genIndex;
        const end = bags[bagIndex + global + 1].genIndex;

        for (let i = start; i < end; i++) {
            genResult.push(gens[i]);
        }

        return genResult;
    }

    private static getKeyRange(instGens: Generator[]): number[] { //minimum and maximum respectively
        let keyRangeGen = this.getGensOfType(instGens, OPS.keyRange);
        if (keyRangeGen.length > 0) {
            let gen = keyRangeGen[0]; //will only be one in the array if it exists
            let high = (gen >>> 8) & 0xFF;
            let low = gen & 0xFF;
            return [low, high];
        } else {
            return [0, 127]; //default to all pitches
        }
    }

    private static getGensOfType(instGens: Generator[], op: number): number[] { //returns array of amounts
        let result: number[] = [];
        for (const g of instGens) {
            if (g.op == op) {
                result.push(g.amt);
            }
        }
        return result;
    }

    public static getAllPresetSamples(soundfontIndex: number, presetIndex: number): number[] {
        const waves: number[] = [];
        const sf = Soundfont.loadedSoundfonts[soundfontIndex];
        for (let pZone of sf.presets[presetIndex].presetZones) {
            for (let iZone of pZone.instrument.instrumentZones) {
                waves.push(iZone.sampleIndex);
            }
        }
        return waves;
    }

    public static getSamplesFromMidiPitch(soundfontIndex: number, presetIndex: number, pitch: number): number[] {
        const waves: number[] = [];
        const sf = Soundfont.loadedSoundfonts[soundfontIndex];
        for (let pZone of sf.presets[presetIndex].presetZones) {
            for (let iZone of pZone.instrument.instrumentZones) {
                if (pitch >= iZone.minPitch && pitch <= iZone.maxPitch) {
                    waves.push(iZone.sampleIndex);
                }   
            }
        }
        return waves;
    }

    constructor(name: string, presets: Preset[], chipWaves: Float32Array[], rawChipWaves: Float32Array[], rawRawChipWaves: Float32Array[], sampleInfo: SampleInfo[], url: string, success: boolean) {
        this.name = name;
        this.presets = presets;
        this.chipWaves = chipWaves;
        this.rawChipWaves = rawChipWaves;
        this.rawRawChipWaves = rawRawChipWaves;
        this.sampleInfo = sampleInfo;
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