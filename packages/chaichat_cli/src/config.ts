import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

interface Config {
  name: string;
  vercelAiSdkKey: string;
  configPath: string;
}

class ConfigManager {
  private configPath: string;
  private config: Partial<Config> = {};

  constructor() {
    const homeDir = homedir();
    const configDir = join(homeDir, ".opentui-ai-gateway");

    if (!existsSync(configDir)) {
      mkdirSync(configDir, { recursive: true });
    }

    this.configPath = join(configDir, "config.json");
    this.loadConfig();
  }

  private loadConfig(): void {
    try {
      if (existsSync(this.configPath)) {
        const configData = readFileSync(this.configPath, "utf8");
        this.config = JSON.parse(configData);
      }
    } catch (error) {
      console.log("No existing config found, starting fresh.", error);
    }
  }

  private saveConfig(): void {
    try {
      const configData = JSON.stringify(this.config, null, 2);
      writeFileSync(this.configPath, configData, "utf8");
    } catch (error) {
      console.error("Error saving config:", error);
    }
  }

  setName(name: string): void {
    this.config.name = name;
    this.saveConfig();
  }

  getName(): string | undefined {
    return this.config.name;
  }

  setVercelAiSdkKey(key: string): void {
    this.config.vercelAiSdkKey = key;
    this.saveConfig();
  }

  getVercelAiSdkKey(): string | undefined {
    return this.config.vercelAiSdkKey;
  }

  getConfigPath(): string {
    return this.configPath;
  }

  hasVercelAiSdkKey(): boolean {
    return !!this.config.vercelAiSdkKey;
  }
}

export const configManager = new ConfigManager();