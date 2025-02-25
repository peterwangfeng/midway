import {
  IMidwayBootstrapOptions,
  IMidwayContainer,
  initializeGlobalApplicationContext,
  destroyGlobalApplicationContext,
} from '@midwayjs/core';
import { join } from 'path';
import { IMidwayLogger, MidwayBaseLogger } from '@midwayjs/logger';

export function isTypeScriptEnvironment() {
  const TS_MODE_PROCESS_FLAG: string = process.env.MIDWAY_TS_MODE;
  if ('false' === TS_MODE_PROCESS_FLAG) {
    return false;
  }
  // eslint-disable-next-line node/no-deprecated-api
  return TS_MODE_PROCESS_FLAG === 'true' || !!require.extensions['.ts'];
}

export class BootstrapStarter {
  protected appDir: string;
  protected baseDir: string;
  protected globalOptions: Partial<IMidwayBootstrapOptions> = {};
  protected globalConfig: any;
  private applicationContext: IMidwayContainer;

  public configure(options: IMidwayBootstrapOptions) {
    this.globalOptions = options;
    return this;
  }

  public async init() {
    this.appDir = this.globalOptions.appDir || process.cwd();
    this.baseDir = this.getBaseDir();

    this.applicationContext = await initializeGlobalApplicationContext({
      ...this.globalOptions,
      appDir: this.appDir,
      baseDir: this.baseDir,
    });
    return this.applicationContext;
  }

  public async run() {
    this.applicationContext = await this.init();
  }

  public async stop() {
    await destroyGlobalApplicationContext(this.applicationContext);
  }

  public getApplicationContext() {
    return this.applicationContext;
  }

  protected getBaseDir() {
    if (this.globalOptions.baseDir) {
      return this.globalOptions.baseDir;
    }
    if (isTypeScriptEnvironment()) {
      return join(this.appDir, 'src');
    } else {
      return join(this.appDir, 'dist');
    }
  }
}

export class Bootstrap {
  private static starter: BootstrapStarter;
  private static logger: IMidwayLogger;
  private static configured = false;

  /**
   * set global configuration for midway
   * @param configuration
   */
  static configure(configuration: IMidwayBootstrapOptions = {}) {
    this.configured = true;
    if (!this.logger && !configuration.logger) {
      this.logger = new MidwayBaseLogger({
        disableError: true,
        disableFile: true,
      });
      if (configuration.logger === false) {
        this.logger?.['disableConsole']();
      }
      configuration.logger = this.logger;
    } else {
      this.logger = this.logger || (configuration.logger as IMidwayLogger);
    }

    // 处理三方框架内部依赖 process.cwd 来查找 node_modules 等问题
    if (configuration.appDir && configuration.appDir !== process.cwd()) {
      process.chdir(configuration.appDir);
    }

    this.getStarter().configure(configuration);
    return this;
  }

  private static getStarter() {
    if (!this.starter) {
      this.starter = new BootstrapStarter();
    }
    return this.starter;
  }

  static async run() {
    if (!this.configured) {
      this.configure();
    }
    // https://nodejs.org/api/process.html#process_signal_events
    // https://en.wikipedia.org/wiki/Unix_signal
    // kill(2) Ctrl-C
    process.once('SIGINT', this.onSignal.bind(this, 'SIGINT'));
    // kill(3) Ctrl-\
    process.once('SIGQUIT', this.onSignal.bind(this, 'SIGQUIT'));
    // kill(15) default
    process.once('SIGTERM', this.onSignal.bind(this, 'SIGTERM'));

    process.once('exit', this.onExit.bind(this));

    this.uncaughtExceptionHandler = this.uncaughtExceptionHandler.bind(this);
    process.on('uncaughtException', this.uncaughtExceptionHandler);

    this.unhandledRejectionHandler = this.unhandledRejectionHandler.bind(this);
    process.on('unhandledRejection', this.unhandledRejectionHandler);

    return this.getStarter()
      .run()
      .then(() => {
        this.logger.info('[midway:bootstrap] current app started');
        global['MIDWAY_BOOTSTRAP_APP_READY'] = true;
      })
      .catch(err => {
        this.logger.error(err);
        process.exit(1);
      });
  }

  static async stop() {
    await this.getStarter().stop();
    process.removeListener('uncaughtException', this.uncaughtExceptionHandler);
    process.removeListener(
      'unhandledRejection',
      this.unhandledRejectionHandler
    );
    this.reset();
    global['MIDWAY_BOOTSTRAP_APP_READY'] = false;
  }

  static reset() {
    this.configured = false;
    this.starter = null;
    this.logger.close();
  }

  /**
   * on bootstrap receive a exit signal
   * @param signal
   */
  private static async onSignal(signal) {
    this.logger.info('[midway:bootstrap] receive signal %s, closing', signal);
    try {
      await this.stop();
      this.logger.info('[midway:bootstrap] close done, exiting with code:0');
      process.exit(0);
    } catch (err) {
      this.logger.error('[midway:bootstrap] close with error: ', err);
      process.exit(1);
    }
  }

  /**
   * on bootstrap process exit
   * @param code
   */
  private static onExit(code) {
    this.logger.info('[midway:bootstrap] exit with code:%s', code);
  }

  private static uncaughtExceptionHandler(err) {
    if (!(err instanceof Error)) {
      err = new Error(String(err));
    }
    if (err.name === 'Error') {
      err.name = 'unhandledExceptionError';
    }
    this.logger.error(err);
  }

  private static unhandledRejectionHandler(err) {
    if (!(err instanceof Error)) {
      const newError = new Error(String(err));
      // err maybe an object, try to copy the name, message and stack to the new error instance
      if (err) {
        if (err.name) newError.name = err.name;
        if (err.message) newError.message = err.message;
        if (err.stack) newError.stack = err.stack;
      }
      err = newError;
    }
    if (err.name === 'Error') {
      err.name = 'unhandledRejectionError';
    }
    this.logger.error(err);
  }

  static getApplicationContext(): IMidwayContainer {
    return this.getStarter().getApplicationContext();
  }
}
