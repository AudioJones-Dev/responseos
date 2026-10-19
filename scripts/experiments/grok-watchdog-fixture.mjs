import fs from "node:fs";
import { transitionSyntheticCall } from "./grok-safety-model.mjs";

const [stateFile, outputFile, time] = process.argv.slice(2);
const state = JSON.parse(fs.readFileSync(stateFile, "utf8"));
const result = transitionSyntheticCall(state, { type: "watchdog", target: state.target }, Number(time));
fs.writeFileSync(outputFile, JSON.stringify({ pid: process.pid, ...result }));
