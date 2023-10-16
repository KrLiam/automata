import { XMLParser, XMLBuilder } from "fast-xml-parser";
import type { TuringMachine, TuringShiftChar } from "./automaton";

const options = {
    ignoreAttributes : false
};

const parser = new XMLParser(options);
const builder = new XMLBuilder(options);

export function convert_turing_xml(turing: TuringMachine) {
    const state_to_id: {[name: string]: number} = {};
    for (const [id, state_name] of Array.from(turing.states).entries()) {
        state_to_id[state_name] = id;
    }

    const tape_to_id: {[name: string]: string} = {};
    for (const [id, tape_name] of turing.tapes.entries()) {
        tape_to_id[tape_name] = (id + 1).toString();
    }

    const states = Array.from(turing.states).map(state => ({
        "@_id": state_to_id[state].toString(),
        "@_name": state,
        x: 0,
        y: 0,
        ...(state == turing.initial_state ? {initial: ""} : {}),
        ...(turing.final_states.has(state) ? {final: ""} : {}),
    }));

    const char_map: {[char: string]: string} = {
        ">": "R",
        "<": "L",
        "-": "S",
    };
    const transitions: any[] = [];
    for (const [start, read, end, write, shift] of turing.transition_map.transitions()) {
        const converted_read = read.map((char, i) => ({
            "@_tape": tape_to_id[turing.tapes[i]],
            ...(char ? {"#text": char} : {})
        }));

        const converted_write = write.map((char, i) => ({
            "@_tape": tape_to_id[turing.tapes[i]],
            ...(char ? {"#text": char} : {})
        }));

        const converted_shift = shift.map((char, i) => ({
            "@_tape": tape_to_id[turing.tapes[i]],
            "#text": char_map[char],
        }));

        transitions.push({
            from: state_to_id[start],
            read: converted_read,
            to: state_to_id[end],
            write: converted_write,
            move: converted_shift,
        });
    }

    const result = {
        "?xml": {
            "@_version": "1.0",
            "@_encoding": "UTF-8",
            "@_standalone": "no",
        },
        structure: {
            type: "turing",
            tapes: turing.tapes.length,
            automaton: {
                state: states,
                transition: transitions,
            }
        }
    };
    return builder.build(result);
}