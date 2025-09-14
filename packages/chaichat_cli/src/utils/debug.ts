import type { CliRenderer } from "@opentui/core";

let isDebugVisible = false;
let originalConsoleLog: typeof console.log;
let originalConsoleError: typeof console.error;
let originalConsoleWarn: typeof console.warn;
let originalConsoleInfo: typeof console.info;
let originalConsoleDebug: typeof console.debug;
let debugLogs: string[] = [];
const maxLogs = 100;

export function debug(renderer: CliRenderer) {
    if (isDebugVisible) {
        // Hide debug console and restore original console methods
        renderer.console.hide();
        isDebugVisible = false;
        restoreConsole();
    } else {
        // Show debug console and intercept all console calls
        renderer.console.show();
        isDebugVisible = true;
        interceptConsole();
        displayCapturedLogs();
    }
}

function interceptConsole() {
    originalConsoleLog = console.log;
    originalConsoleError = console.error;
    originalConsoleWarn = console.warn;
    originalConsoleInfo = console.info;
    originalConsoleDebug = console.debug;

    // Intercept console.log
    console.log = (...args) => {
        const message = args.map(arg => 
            typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' ');
        
        addLogEntry('LOG', message);
        originalConsoleLog(...args);
    };

    // Intercept console.error
    console.error = (...args) => {
        const message = args.map(arg => 
            typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' ');
        
        addLogEntry('ERROR', message);
        originalConsoleError(...args);
    };

    // Intercept console.warn
    console.warn = (...args) => {
        const message = args.map(arg => 
            typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' ');
        
        addLogEntry('WARN', message);
        originalConsoleWarn(...args);
    };

    // Intercept console.info
    console.info = (...args) => {
        const message = args.map(arg => 
            typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' ');
        
        addLogEntry('INFO', message);
        originalConsoleInfo(...args);
    };

    // Intercept console.debug
    console.debug = (...args) => {
        const message = args.map(arg => 
            typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' ');
        
        addLogEntry('DEBUG', message);
        originalConsoleDebug(...args);
    };

    process.on('uncaughtException', (error) => {
        addLogEntry('ERROR', `Uncaught Exception: ${error.message}\n${error.stack}`);
    });
    
    process.on('unhandledRejection', (reason, promise) => {
        addLogEntry('ERROR', `Unhandled Promise Rejection: ${reason}, promise: ${promise}`);
    });
}

function restoreConsole() {
    if (originalConsoleLog) console.log = originalConsoleLog;
    if (originalConsoleError) console.error = originalConsoleError;
    if (originalConsoleWarn) console.warn = originalConsoleWarn;
    if (originalConsoleInfo) console.info = originalConsoleInfo;
    if (originalConsoleDebug) console.debug = originalConsoleDebug;
}

function addLogEntry(level: string, message: string) {
    const timestamp = new Date().toLocaleTimeString();
    const entry = `[${timestamp}] ${level}: ${message}`;
    
    debugLogs.push(entry);
    
    if (debugLogs.length > maxLogs) { // 100 logs max
        debugLogs = debugLogs.slice(-maxLogs);
    }
}

function displayCapturedLogs() {
    // if (debugLogs.length === 0) {
    //     originalConsoleLog("No logs captured yet. Start using the app to see logs here!");
    //     return;
    // }

    debugLogs.forEach(log => {
        originalConsoleLog(log);
    });
}

export function isDebugViewVisible(): boolean {
    return isDebugVisible;
}

export function getCapturedLogs(): string[] {
    return [...debugLogs];
}

export function clearCapturedLogs(): void {
    debugLogs = [];
}

export function addCustomLog(level: string, message: string): void {
    addLogEntry(level, message);
}