import Express, { Application } from 'express';
import { gql, LazyPromise } from 'graphql-ez';

import { BuildAppOptions, CreateApp, ExpressAppOptions, EZApp, EZAppBuilder } from '@graphql-ez/express';
import { BaseYogaConfig, getYogaPreset } from '@graphql-yoga/preset';

import type { Server as httpServer } from 'http';
import type { Server as httpsServer, ServerOptions as httpsServerOptions } from 'https';

export interface YogaConfig
  extends BaseYogaConfig,
    Pick<
      ExpressAppOptions,
      | 'path'
      | 'cors'
      | 'processRequestOptions'
      | 'allowBatchedQueries'
      | 'buildContext'
      | 'cache'
      | 'customHandleRequest'
      | 'envelop'
      | 'introspection'
      | 'onAppRegister'
      | 'prepare'
      | 'bodyParserJSONOptions'
    > {
  buildAppOptions?: BuildAppOptions;

  /**
   * Create HTTPS Server options
   */
  https?: httpsServerOptions;
}

export { gql };

export interface StartOptions {
  /**
   * @default process.env.PORT || 8080
   */
  port?: number | string;
  /**
   * @default 0.0.0.0
   */
  host?: string;
  /**
   * Parameter to specify the maximum length of the queue of pending connections
   *
   * @default 511
   */
  backlog?: number;
}

export interface YogaApp {
  expressApp: Application;
  ezApp: EZAppBuilder;
  builtApp: Promise<EZApp>;
  start(options?: StartOptions): Promise<httpServer | httpsServer>;
}

export function GraphQLServer(config: YogaConfig = {}): YogaApp {
  const {
    buildAppOptions,
    path,
    cors,
    processRequestOptions,
    allowBatchedQueries,
    buildContext,
    cache,
    customHandleRequest,
    envelop,
    introspection,
    onAppRegister,
    prepare,
    schema,
    bodyParserJSONOptions,
    https,
    ...presetOptions
  } = config;

  const preset = getYogaPreset({ schema: typeof schema === 'object' ? schema : undefined, ...presetOptions });

  const ezApp = CreateApp({
    ez: {
      preset,
    },
    path,
    cors,
    processRequestOptions,
    allowBatchedQueries,
    buildContext,
    cache,
    customHandleRequest,
    envelop,
    introspection,
    onAppRegister,
    prepare,
    bodyParserJSONOptions,
  });

  const expressApp = Express();

  const serverPromise = LazyPromise<httpServer | httpsServer>(async () => {
    if (https) {
      const { createServer } = await import('https');

      return createServer(https, expressApp);
    }

    const { createServer } = await import('http');

    return createServer(expressApp);
  });

  const builtApp = LazyPromise(() => {
    return ezApp.buildApp({ app: expressApp, ...buildAppOptions });
  });

  async function start({ port = process.env.PORT || 8080, host = '0.0.0.0', ...rest }: StartOptions = {}) {
    const { router } = await builtApp;

    expressApp.use(router);

    const server = await serverPromise;

    return server.listen({ port: typeof port === 'string' ? parseInt(port) : port, host, ...rest });
  }

  return {
    ezApp,
    expressApp,
    builtApp,
    start,
  };
}

export * from 'graphql-ez';
