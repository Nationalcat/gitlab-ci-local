import c = require("ansi-colors");
import * as dotProp from "dot-prop";
import * as shelljs from "shelljs";
import {IKeyValue} from "./index";

const shell = process.env.EXEPATH ? `${process.env.EXEPATH}/bash.exe` : "/bin/bash";

export class Job {

    private static getScriptLikeFromData(jobData: any, keyname: string): string[] {
        const sc = dotProp.get<string | string[] | undefined>(jobData, keyname);
        if (sc) {
            let scripts: string[] = [];
            scripts = scripts.concat(sc);
            return scripts;
        }
        return [];
    }

    public readonly stage: string;
    public readonly name: string;

    private readonly cwd: any;

    private readonly globalVariables: IKeyValue;
    private readonly variables: IKeyValue;
    private variablesLocal: IKeyValue = {};

    private beforeScripts: string[] = [];
    private scripts: string[] = [];

    constructor(jobData: any, name: string, cwd: any, globalVariables: IKeyValue) {
        this.name = name;
        this.cwd = cwd;
        this.globalVariables = globalVariables;
        this.stage = dotProp.get<string>(jobData, "stage") || ".pre";

        this.scripts = Job.getScriptLikeFromData(jobData, "script");
        this.beforeScripts = Job.getScriptLikeFromData(jobData, "before_script");

        this.variables = dotProp.get<IKeyValue>(jobData, "variables") || {};
    }

    public override(jobData: any): void {
        const scripts = Job.getScriptLikeFromData(jobData, "script");
        this.scripts = scripts.length > 0 ? scripts : this.scripts;
        const beforeScripts = Job.getScriptLikeFromData(jobData, "before_script");
        this.beforeScripts = beforeScripts.length > 0 ? beforeScripts : this.beforeScripts;
        this.variablesLocal = dotProp.get<IKeyValue>(jobData, "variables") || {};
    }

    public start(): Promise<boolean> {
        return new Promise<boolean>((resolve, reject) => {
            if (this.scripts.length === 0) {
                console.error(`${c.blueBright(`${this.name}`)} ${c.red(`must have script specified`)}`);
                process.exit(1);
            }

            const prescripts = this.beforeScripts.concat(this.scripts);

            try {
                this.exec(prescripts.join(" && "), resolve, reject);
            } catch (e) {
                console.error(e);
                reject(e);
            }
        });
    }

    public toString() {
        return this.name;
    }

    private getEnvs(): IKeyValue {
        return {...this.globalVariables, ...this.variables, ...this.variablesLocal, ...process.env};
    }

    private exec(script: string, resolve: (b: boolean) => void, reject: (e: string) => void) {
        const child = shelljs.exec(`${script}`, {
            cwd: this.cwd,
            env: this.getEnvs(),
            async: true,
            silent: true,
            shell,
        });

        child.on("error", (e) => {
            console.error(e);
        });

        if (child.stdout) {
            child.stdout.on("data", (buf) => {
                process.stdout.write(`${c.blueBright(`${this.name}`)}: ${buf}`);
            });
        }

        if (child.stderr) {
            child.stderr.on("data", (buf) => {
                process.stderr.write(`${c.blueBright(`${this.name}`)}: ${c.red(`${buf}`)}`);
            });
        }

        child.on("exit", (code) => {
            if (code !== 0) {
                console.error(`Bad Exit ${c.red(`${this.name}`)} with ${code}`);
                reject(`${this.name} exited with code ${code}`);
                return;
            }
            console.log(`Finished ${c.blueBright(`${this.name}`)}`);
            resolve(true);
        });
    }
}
