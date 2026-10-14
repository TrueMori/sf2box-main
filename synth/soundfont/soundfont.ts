import {ChipWave} from "../SynthConfig"

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

    public static readonly loadedSoundfonts: Array<Soundfont> = [
        new Soundfont("https://file.garden/ZxBw28OpLwxBlXVc/Bluegrass_Banjo.sf2"),
    ];

    constructor(url: string) {
        
        this.name = "";

        // testing
            let sz1: SampleZone = {
                low: 0,
                high: 1,
                sample: 1,
            };
            let iz1: InstrumentZone = {
                low: 0,
                high: 1,
                sampleZones: [sz1],
            };
            let sp1: SoundfontPreset = {
                name: name + " preset 1",
                instrumentZones: [iz1],
            }
            let sp2: SoundfontPreset = {
                name: name + " preset 2",
                instrumentZones: [iz1],
            }
        //testing

        this.presets = [sp1, sp2];
        this.url = url;
        this.samples = [];

        //get data
        fetch(url).then((response) => {
        if (!response.ok) {
            return Promise.reject(new Error("Couldn't load sample"));
        }
        return response.arrayBuffer;
        });
    }
}