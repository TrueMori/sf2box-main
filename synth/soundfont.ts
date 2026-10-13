import {ChipWave, Dictionary} from "./SynthConfig"

interface InstrumentZone {
    low: number;
    high: number;
    sampleZones: Array<SampleZone>;
}

interface SampleZone {
    low: number;
    high: number;
    sample: number;
}

interface SoundfontPreset {
    instrumentZones: Array<InstrumentZone>;
}

export class Soundfont {
    public readonly name: string;
    private samples: Array<ChipWave>;
    private presets: Array<SoundfontPreset>;

    public static readonly loadedSoundfonts: Dictionary<Soundfont> = {
        awesome: new Soundfont("awesome"),
        awesomer: new Soundfont("awesomer"),
    };

    constructor(name: string) {
        this.name = name;
        this.samples = [];
        this.presets = [];

        // Multiple soundfonts with same name? Hrm.
        // Also, we'll add this once there's a way to actually add soundfonts.
        // For now, they'll just be added straight into the loaded soundfont dict.
            //Soundfont.loadedSoundfonts[this.name] = this

        console.log(this.samples, this.presets);
    }
}