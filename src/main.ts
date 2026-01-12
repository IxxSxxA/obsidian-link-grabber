// src/main.ts

import { Plugin } from "obsidian";
import { PluginCore } from "./core/PluginCore";
import { Logger } from "./utils/Logger";

Logger.pluginLifecycle("loading");

Logger.log("THIS IS A TEST MESSAGE FROM ME AND THE OTHER MYSELF");
Logger.log("********  FUCK YOU BILL ->  DELETE IN PROD ********");

export default class LinkGrabberPlugin extends Plugin {
  private pluginCore!: PluginCore;

  async onload() {

    // Wait for onLayoutReady
    this.app.workspace.onLayoutReady(async () => {

      this.pluginCore = new PluginCore(this);
      await this.pluginCore.initialize();
    });
  }

  async onunload() {
    Logger.pluginLifecycle("unloading");
    await this.pluginCore.cleanup(); // ✅ Let's clean everything
  }
}
