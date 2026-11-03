// prefix.js - ESM Version
import config from '../config.js';

let currentPrefix = config.PREFIX; // default prefix from settings.js

export function getPrefix() {
    return currentPrefix;
}

export function setPrefix(newPrefix) {
    currentPrefix = newPrefix;
}

export default {
    getPrefix,
    setPrefix
};